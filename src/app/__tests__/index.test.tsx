import { render } from '@testing-library/react-native';

import Index from '@/app/index';

const mockUseAuth = jest.fn();

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, href),
  };
});

describe('protected root route', () => {
  beforeEach(() => mockUseAuth.mockReset());

  it('sends signed-out users to login', async () => {
    mockUseAuth.mockReturnValue({ loading: false, session: null });
    const view = await render(<Index />);
    expect(view.getByTestId('redirect')).toHaveTextContent('/(auth)/login');
  });

  it('sends signed-in users to the protected tabs', async () => {
    mockUseAuth.mockReturnValue({ loading: false, session: { user: { id: 'user-1' } } });
    const view = await render(<Index />);
    expect(view.getByTestId('redirect')).toHaveTextContent('/(tabs)');
  });

  it('does not redirect before auth restoration finishes', async () => {
    mockUseAuth.mockReturnValue({ loading: true, session: null });
    const view = await render(<Index />);
    expect(view.queryByTestId('redirect')).toBeNull();
  });
});
