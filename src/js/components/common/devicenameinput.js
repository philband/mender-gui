import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';

// material ui
import { Check as CheckIcon, Clear as ClearIcon, Edit as EditIcon } from '@mui/icons-material';
import { IconButton, Input, InputAdornment } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

import { setSnackbar } from '../../actions/appActions';
import { setDeviceTags } from '../../actions/deviceActions';

const useStyles = makeStyles()(theme => ({
  icon: {
    fontSize: '1.25rem'
  },
  input: {
    color: theme.palette.text.primary,
    fontSize: '0.8125rem'
  }
}));

export const DeviceNameInput = ({ device, isHovered, setSnackbar, setDeviceTags }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const { classes } = useStyles();

  const { id = '', tags = {} } = device;
  const { name = '' } = tags;

  useEffect(() => {
    if (!isEditing && name !== value) {
      setValue(name);
    }
  }, [device, isEditing]);

  const onSubmit = () => {
    const changedTags = {
      ...tags,
      name: value
    };
    setDeviceTags(id, changedTags).then(() => {
      setSnackbar('Device name changed');
      setIsEditing(false);
    });
  };

  const onCancel = () => {
    setValue(name);
    setIsEditing(false);
  };

  const onStartEdit = e => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const editButton = (
    <IconButton onClick={onStartEdit} size="small">
      <EditIcon className={classes.icon} />
    </IconButton>
  );

  const buttonArea = isEditing ? (
    <>
      <IconButton onClick={onSubmit} size="small">
        <CheckIcon className={classes.icon} />
      </IconButton>
      <IconButton onClick={onCancel} size="small">
        <ClearIcon className={classes.icon} />
      </IconButton>
    </>
  ) : (
    editButton
  );

  const onInputClick = e => e.stopPropagation();

  return (
    <Input
      id={`${device.id}-id-input`}
      className={classes.input}
      disabled={!isEditing}
      value={value}
      placeholder={`${id.substring(0, 6)}...`}
      onClick={onInputClick}
      onChange={({ target: { value } }) => setValue(value)}
      type="text"
      endAdornment={(isHovered || isEditing) && <InputAdornment position="end">{buttonArea}</InputAdornment>}
    />
  );
};

const actionCreators = {
  setDeviceTags,
  setSnackbar
};

export default connect(undefined, actionCreators)(DeviceNameInput);
