import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LoginScreen from '@/app/(auth)/login';
import SignupScreen from '@/app/(auth)/signup';

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();
const mockSearchParams = jest.fn();

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('expo-router', () => {
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    router: { back: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
    useLocalSearchParams: () => mockSearchParams(),
  };
});
jest.mock('expo-image', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { Image: (props: object) => React.createElement(View, props) };
});

describe('authentication screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.mockReturnValue({});
  });

  it('redirects a successful account creation to login', async () => {
    const signUp = jest.fn().mockResolvedValue({ requiresEmailConfirmation: true });
    mockUseAuth.mockReturnValue({ signUp });
    const view = await render(<SignupScreen />);

    await fireEvent.changeText(view.getByLabelText('Username'), 'new_sock');
    await fireEvent.changeText(view.getByLabelText('Display name (optional)'), 'New Sock');
    await fireEvent.changeText(view.getByLabelText('Email'), 'new@sock.test');
    await fireEvent.changeText(view.getByLabelText('Password'), 'password123');
    await fireEvent.press(view.getByLabelText('Create account'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(auth)/login',
        params: { created: 'confirm' },
      }),
    );
    await view.unmount();
  });

  it('shows a persistent error when account creation fails', async () => {
    const signUp = jest.fn().mockRejectedValue(new Error('User already registered'));
    mockUseAuth.mockReturnValue({ signUp });
    const view = await render(<SignupScreen />);

    await fireEvent.changeText(view.getByLabelText('Username'), 'new_sock');
    await fireEvent.changeText(view.getByLabelText('Email'), 'new@sock.test');
    await fireEvent.changeText(view.getByLabelText('Password'), 'password123');
    await fireEvent.press(view.getByLabelText('Create account'));

    await waitFor(() =>
      expect(view.getByText('An account already uses that email.')).toBeTruthy(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('redirects a successful login into the app', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ signIn });
    const view = await render(<LoginScreen />);

    await fireEvent.changeText(view.getByLabelText('College email'), 'user@sock.test');
    await fireEvent.changeText(view.getByLabelText('Password'), 'password123');
    await fireEvent.press(view.getByLabelText('Log in'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    await view.unmount();
  });

  it('shows the account-created state on login', async () => {
    mockSearchParams.mockReturnValue({ created: '1' });
    mockUseAuth.mockReturnValue({ signIn: jest.fn() });
    const view = await render(<LoginScreen />);

    expect(view.getByText('Account created. Log in to continue.')).toBeTruthy();
    await view.unmount();
  });

  it('asks confirmation-required accounts to check their email', async () => {
    mockSearchParams.mockReturnValue({ created: 'confirm' });
    mockUseAuth.mockReturnValue({ signIn: jest.fn() });
    const view = await render(<LoginScreen />);

    expect(view.getByText('Check your email to confirm your account, then log in.')).toBeTruthy();
    await view.unmount();
  });
});
