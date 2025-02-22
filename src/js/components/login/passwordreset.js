import React, { useState } from 'react';
import { connect } from 'react-redux';
import { useParams } from 'react-router-dom';

import { setSnackbar } from '../../actions/appActions';
import { passwordResetComplete } from '../../actions/userActions';
import { TIMEOUTS } from '../../constants/appConstants';
import Form from '../common/forms/form';
import PasswordInput from '../common/forms/passwordinput';
import { PasswordScreenContainer } from './password';

export const PasswordReset = ({ passwordResetComplete, setSnackbar }) => {
  const [confirm, setConfirm] = useState(false);
  const { secretHash } = useParams();

  const _handleSubmit = formData => {
    if (!formData.hasOwnProperty('password_new')) {
      return;
    }
    if (formData.password_new != formData.password_confirmation) {
      setSnackbar('The passwords you provided do not match, please check again.', TIMEOUTS.fiveSeconds, '');
      return;
    }

    passwordResetComplete(secretHash, formData.password_new).then(() => setConfirm(true));
  };

  return (
    <PasswordScreenContainer title="Change your password">
      {confirm ? (
        <p className="margin-bottom align-center">Your password has been updated.</p>
      ) : (
        <>
          <p className="margin-bottom align-center">
            You requested to change your password.
            <br />
            Enter a new, secure password of your choice below.
          </p>
          <Form
            showButtons={true}
            buttonColor="primary"
            onSubmit={formdata => _handleSubmit(formdata)}
            submitLabel="Save password"
            submitButtonId="password_button"
          >
            <PasswordInput id="password_new" label="Password *" validations="isLength:8" create={true} generate={false} required={true} />
            <PasswordInput id="password_confirmation" label="Confirm password *" validations="isLength:8" required={true} />
          </Form>
        </>
      )}
    </PasswordScreenContainer>
  );
};

const actionCreators = { passwordResetComplete, setSnackbar };

export default connect(null, actionCreators)(PasswordReset);
