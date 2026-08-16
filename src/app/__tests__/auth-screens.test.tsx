import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LoginScreen from '@/app/(auth)/login';
import SignupScreen from '@/app/(auth)/signup';
import ResetPasswordScreen from '@/app/reset-password';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockUseAuth = jest.fn();
const mockSearchParams = jest.fn();

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('expo-router', () => {
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    router: {
      back: jest.fn(),
      push: (...args: unknown[]) => mockPush(...args),
      replace: (...args: unknown[]) => mockReplace(...args),
    },
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
    await fireEvent.changeText(view.getByLabelText('Date of birth'), '01 / 01 / 2000');
    await fireEvent.changeText(view.getByLabelText('Password'), 'password123');
    await fireEvent.press(view.getByLabelText('I agree to the Terms of Service and acknowledge the Privacy Policy'));
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
    await fireEvent.changeText(view.getByLabelText('Date of birth'), '01 / 01 / 2000');
    await fireEvent.changeText(view.getByLabelText('Password'), 'password123');
    await fireEvent.press(view.getByLabelText('I agree to the Terms of Service and acknowledge the Privacy Policy'));
    await fireEvent.press(view.getByLabelText('Create account'));

    await waitFor(() =>
      expect(view.getByText(/can’t make another account with this email/i)).toBeTruthy(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('requires the explicit legal agreement before enabling account creation', async () => {
    mockUseAuth.mockReturnValue({ signUp: jest.fn() });
    const view = await render(<SignupScreen />);

    expect(view.getByLabelText('Create account').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByLabelText('I agree to the Terms of Service and acknowledge the Privacy Policy'));
    expect(view.getByLabelText('Create account').props.accessibilityState.disabled).toBe(false);
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

  it('opens password recovery with the login email filled in', async () => {
    mockUseAuth.mockReturnValue({ signIn: jest.fn() });
    const view = await render(<LoginScreen />);

    await fireEvent.changeText(view.getByLabelText('College email'), 'user@sock.test');
    await fireEvent.press(view.getByLabelText('Forgot password?'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/reset-password', params: { email: 'user@sock.test' } });
    await view.unmount();
  });

  it('lets people reveal and hide their password on login and signup', async () => {
    mockUseAuth.mockReturnValue({ signIn: jest.fn(), signUp: jest.fn() });
    const login = await render(<LoginScreen />);

    expect(login.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(login.getByLabelText('Show password'));
    expect(login.getByLabelText('Hide password')).toBeTruthy();
    expect(login.getByLabelText('Password').props.secureTextEntry).toBe(false);
    await login.unmount();

    const signup = await render(<SignupScreen />);
    expect(signup.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(signup.getByLabelText('Show password'));
    expect(signup.getByLabelText('Hide password')).toBeTruthy();
    expect(signup.getByLabelText('Password').props.secureTextEntry).toBe(false);
    await signup.unmount();
  });

  it('emails a reset code before asking for a new password', async () => {
    const requestPasswordReset = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      requestPasswordReset,
      verifyPasswordResetCode: jest.fn(),
      completePasswordReset: jest.fn(),
    });
    const view = await render(<ResetPasswordScreen />);

    await fireEvent.changeText(view.getByLabelText('Account email'), 'user@sock.test');
    await fireEvent.press(view.getByLabelText('Email reset code'));

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('user@sock.test'));
    expect(view.getAllByText(/6-digit reset code/i).length).toBeGreaterThan(0);
    expect(view.getByText(/expires in 10 minutes/i)).toBeTruthy();
    await view.unmount();
  });

  it('verifies a reset code and only saves matching new passwords', async () => {
    const requestPasswordReset = jest.fn().mockResolvedValue(undefined);
    const verifyPasswordResetCode = jest.fn().mockResolvedValue({ access_token: 'access', refresh_token: 'refresh' });
    const completePasswordReset = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ requestPasswordReset, verifyPasswordResetCode, completePasswordReset });
    const view = await render(<ResetPasswordScreen />);

    await fireEvent.changeText(view.getByLabelText('Account email'), 'user@sock.test');
    await fireEvent.press(view.getByLabelText('Email reset code'));
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalled());
    await fireEvent.changeText(view.getByLabelText('6-digit reset code'), '123456');
    await fireEvent.press(view.getByLabelText('Verify code'));
    await waitFor(() => expect(verifyPasswordResetCode).toHaveBeenCalledWith('user@sock.test', '123456'));

    await fireEvent.changeText(view.getByLabelText('New password'), 'fresh-password');
    await fireEvent.changeText(view.getByLabelText('Confirm new password'), 'different-password');
    await fireEvent.press(view.getByLabelText('Reset password'));
    expect(view.getByText('Your new password and confirmation do not match.')).toBeTruthy();
    expect(completePasswordReset).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByLabelText('Confirm new password'), 'fresh-password');
    await fireEvent.press(view.getByLabelText('Reset password'));
    await waitFor(() =>
      expect(completePasswordReset).toHaveBeenCalledWith(
        { access_token: 'access', refresh_token: 'refresh' },
        'fresh-password',
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login?reset=1');
    await view.unmount();
  });
});
