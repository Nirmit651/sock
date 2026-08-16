import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { unregisterCurrentPushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { createAccount } from '@/services/auth';

jest.mock('@/lib/notifications', () => ({
  unregisterCurrentPushToken: jest.fn(),
}));
jest.mock('@/services/auth', () => ({
  createAccount: jest.fn(),
  resendSignupConfirmation: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockUnregisterCurrentPushToken = unregisterCurrentPushToken as jest.Mock;
const mockCreateAccount = createAccount as jest.Mock;

function Harness() {
  const { loading, initializationError, session, retrySession, signIn, signOut, signUp } = useAuth();
  const [signInState, setSignInState] = useState('idle');
  const [signUpState, setSignUpState] = useState('idle');
  return (
    <View>
      <Text testID="state">
        {loading ? 'loading' : initializationError || session?.user.id || 'signed-out'}
      </Text>
      <Pressable testID="retry" onPress={() => void retrySession()} />
      <Pressable testID="sign-out" onPress={() => void signOut()} />
      <Pressable
        testID="sign-in"
        onPress={() => {
          void signIn('user@sock.test', 'password123')
            .then(() => setSignInState('signed-in'))
            .catch((error: Error) => setSignInState(error.message));
        }}
      />
      <Text testID="sign-in-state">{signInState}</Text>
      <Pressable
        testID="sign-up"
        onPress={() => {
          void signUp({
            email: 'new@sock.test',
            password: 'password123',
            username: 'new_sock',
            dateOfBirth: '2000-01-01',
            legalAgreement: true,
          })
            .then(() => setSignUpState('signed-up'))
            .catch((error: Error) => setSignUpState(error.message));
        }}
      />
      <Text testID="sign-up-state">{signUpState}</Text>
    </View>
  );
}

async function renderProvider(client = new QueryClient()) {
  return {
    client,
    view: await render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockReset();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    mockUnregisterCurrentPushToken.mockReset();
    mockCreateAccount.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('creates an account without persisting the signup session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockCreateAccount.mockResolvedValue({ requiresEmailConfirmation: true });
    const { view } = await renderProvider();

    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('signed-out'));
    await act(async () => fireEvent.press(view.getByTestId('sign-up')));
    await waitFor(() => expect(view.getByTestId('sign-up-state')).toHaveTextContent('signed-up'));
    await view.unmount();
  });

  it('propagates an account-creation failure to the form', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockCreateAccount.mockRejectedValue(new Error('User already registered'));
    const { view } = await renderProvider();

    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('signed-out'));
    await act(async () => fireEvent.press(view.getByTestId('sign-up')));
    await waitFor(() =>
      expect(view.getByTestId('sign-up-state')).toHaveTextContent(/already registered/i),
    );
    await view.unmount();
  });

  it('applies the login session immediately', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignIn.mockResolvedValue({
      data: { session: { user: { id: 'logged-in-user' } } },
      error: null,
    });
    const { view } = await renderProvider();

    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('signed-out'));
    await act(async () => fireEvent.press(view.getByTestId('sign-in')));
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('logged-in-user'));
    expect(view.getByTestId('sign-in-state')).toHaveTextContent('signed-in');
    await view.unmount();
  });

  it('finishes loading and exposes a retryable restoration error', async () => {
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null }, error: new Error('offline') })
      .mockResolvedValueOnce({ data: { session: null }, error: null });
    const { view } = await renderProvider();

    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent(/could not restore/i));
    await act(async () => fireEvent.press(view.getByTestId('retry')));
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('signed-out'));
    await view.unmount();
  });

  it('removes only the current installation and clears cached user data on logout', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    const client = new QueryClient();
    client.setQueryData(['profile', 'user-1'], { username: 'alice' });
    const clear = jest.spyOn(client, 'clear');
    const { view } = await renderProvider(client);

    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('user-1'));
    await act(async () => fireEvent.press(view.getByTestId('sign-out')));

    await waitFor(() => {
      expect(mockUnregisterCurrentPushToken).toHaveBeenCalledWith('user-1');
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(clear).toHaveBeenCalled();
    });
    await view.unmount();
  });
});
