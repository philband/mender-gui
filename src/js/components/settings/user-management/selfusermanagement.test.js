import React from 'react';
import { Provider } from 'react-redux';

import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { defaultState, undefineds } from '../../../../../tests/mockData';
import { render } from '../../../../../tests/setupTests';
import SelfUserManagement from './selfusermanagement';

const mockStore = configureStore([thunk]);

describe('SelfUserManagement Component', () => {
  let store;
  beforeEach(() => {
    store = mockStore({ ...defaultState });
  });

  it('renders correctly', async () => {
    store = mockStore({
      ...defaultState,
      users: {
        ...defaultState.users,
        byId: {
          ...defaultState.users.byId,
          [defaultState.users.currentUser]: {
            ...defaultState.users.byId[defaultState.users.currentUser],
            sso: [{ kind: 'oauth2/google' }]
          }
        }
      }
    });
    const { baseElement } = render(
      <Provider store={store}>
        <SelfUserManagement />
      </Provider>
    );
    const view = baseElement.firstChild.firstChild;
    expect(view).toMatchSnapshot();
    expect(view).toEqual(expect.not.stringMatching(undefineds));
  });

  it('works as intended', async () => {
    store = mockStore({ ...defaultState, app: { ...defaultState.app, features: { ...defaultState.app.features, isEnterprise: true } } });

    const copyCheck = jest.fn(() => true);
    document.execCommand = copyCheck;
    const ui = (
      <Provider store={store}>
        <SelfUserManagement />
      </Provider>
    );
    const { rerender } = render(ui);

    userEvent.click(screen.getByRole('button', { name: /email/i }));
    const input = screen.getByDisplayValue(defaultState.users.byId.a1.email);
    userEvent.clear(input);
    userEvent.type(input, 'test@test');
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    userEvent.type(input, '.com');
    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    act(() => userEvent.click(screen.getByRole('button', { name: /change password/i })));
    const form = screen.getByLabelText('Password *').parentElement.parentElement.parentElement.parentElement;
    const passwordGeneration = within(form).getByRole('button', { name: /generate/i });
    userEvent.click(passwordGeneration);
    expect(copyCheck).toHaveBeenCalled();
    userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    act(() => userEvent.click(screen.getByText(/Enable Two Factor authentication/i)));
    await waitFor(() => rerender(ui));
    expect(screen.getByText(/Scan the QR code on the right/i)).toBeInTheDocument();
    userEvent.type(screen.getByPlaceholderText(/Verification code/i), '1234');
    expect(screen.getByText(/Must be at least 6 characters long/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify/i })).toBeDisabled();
    userEvent.type(screen.getByPlaceholderText(/Verification code/i), '56');
    expect(screen.getByRole('button', { name: /Verify/i })).not.toBeDisabled();
    expect(screen.queryByText(/Must be at least 6 characters long/i)).not.toBeInTheDocument();
    await act(async () => userEvent.click(screen.getByRole('button', { name: /Verify/i })));
    jest.runAllTicks();
    await waitFor(() => rerender(ui));
    await waitFor(() => expect(screen.queryByText(/Verifying/)).not.toBeInTheDocument(), { timeout: 5000 });
    userEvent.click(screen.getByRole('button', { name: /Save/i }));
  }, 15000);
});
