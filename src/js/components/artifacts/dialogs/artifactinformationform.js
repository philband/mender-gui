import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { InfoOutlined as InfoIcon } from '@mui/icons-material';
import { Autocomplete, FormControl, Input, InputLabel, TextField, Tooltip } from '@mui/material';

import { TIMEOUTS } from '../../../constants/appConstants';
import { onboardingSteps } from '../../../constants/onboardingConstants';
import { duplicateFilter, unionizeStrings } from '../../../helpers';
import { useDebounce } from '../../../utils/debouncehook';
import { getOnboardingComponentFor } from '../../../utils/onboardingmanager';
import useWindowSize from '../../../utils/resizehook';
import { FileInformation } from './addartifact';

export const ReleaseTooltip = () => (
  <div style={{ fontSize: 12 }}>
    <p>
      If a Release with this name already exists, this new Artifact may be grouped into a Release with other Artifacts of the same name - so long as they are
      compatible with different device types
    </p>
    <Link to="/help/releases-artifacts" style={{ color: '#679ba5' }}>
      Learn more about releases
    </Link>
  </div>
);

const defaultVersion = '1.0.0';

export const VersionInformation = ({ creation = {}, onRemove, updateCreation }) => {
  const { file, fileSystem: propFs, name, softwareName: propName, softwareVersion: version = '', type } = creation;
  const [fileSystem, setFileSystem] = useState(propFs);
  const [softwareName, setSoftwareName] = useState(propName || name.replace('.', '-'));
  const [softwareVersion, setSoftwareVersion] = useState(version || defaultVersion);

  useEffect(() => {
    updateCreation({ finalStep: true });
  }, []);

  useEffect(() => {
    updateCreation({ fileSystem, softwareName, softwareVersion, isValid: fileSystem && softwareName && softwareVersion });
  }, [fileSystem, softwareName, softwareVersion]);

  return (
    <>
      <FileInformation file={file} type={type} onRemove={onRemove} />
      <h4>Version information</h4>
      <div className="flexbox column">
        {[
          { key: 'fileSystem', title: 'Software filesystem', setter: setFileSystem, value: fileSystem },
          { key: 'softwareName', title: 'Software name', setter: setSoftwareName, value: softwareName },
          { key: 'softwareVersion', title: 'Software version', setter: setSoftwareVersion, value: softwareVersion }
        ].map(({ key, title, setter, value: currentValue }, index) => (
          <TextField autoFocus={!index} fullWidth key={key} label={title} onChange={({ target: { value } }) => setter(value)} value={currentValue} />
        ))}
      </div>
    </>
  );
};

const checkDestinationValidity = destination => (destination.length ? /^(?:\/|[a-z]+:\/\/)/.test(destination) : true);

export const ArtifactInformation = ({ advanceOnboarding, creation = {}, deviceTypes = [], onboardingState, onRemove, updateCreation }) => {
  const { customDeviceTypes = [], destination = '', file, name = '', selectedDeviceTypes = [], type } = creation;
  const deviceTypeRef = useRef();
  const releaseNameRef = useRef();
  const destinationRef = useRef();
  // eslint-disable-next-line no-unused-vars
  const size = useWindowSize();

  const debouncedName = useDebounce(name, TIMEOUTS.debounceDefault);

  useEffect(() => {
    const nextDestination = onboardingState.complete ? destination : '/data/www/localhost/htdocs';
    updateCreation({
      destination: nextDestination,
      isValid: checkDestinationValidity(nextDestination) && selectedDeviceTypes.length && name,
      finalStep: false
    });
  }, []);

  useEffect(() => {
    if (debouncedName.length) {
      advanceOnboarding(onboardingSteps.UPLOAD_NEW_ARTIFACT_DIALOG_RELEASE_NAME);
    }
  }, [debouncedName]);

  // to allow device types to automatically be selected on entered ',' we have to filter the input and transform any completed device types (followed by a ',')
  // while also checking for duplicates and allowing complete resets of the input
  const onTextInputChange = (inputValue, reason) => {
    const value = inputValue || '';
    if (reason === 'clear') {
      return updateCreation({ customDeviceTypes: '', selectedDeviceTypes: [], isValid: false });
    } else if (reason === 'reset') {
      return;
    }
    const lastIndex = value.lastIndexOf(',');
    const possibleCustomDeviceTypes = value.substring(0, lastIndex).split(',').filter(duplicateFilter);
    const customDeviceTypes = value.substring(lastIndex + 1);
    const possibleDeviceTypeSelection = unionizeStrings(selectedDeviceTypes, possibleCustomDeviceTypes);
    if (customDeviceTypes.length > 3) {
      advanceOnboarding(onboardingSteps.UPLOAD_NEW_ARTIFACT_DIALOG_DEVICE_TYPE);
    }
    updateCreation({ customDeviceTypes, isValid: possibleDeviceTypeSelection.length && name && destination, selectedDeviceTypes: possibleDeviceTypeSelection });
  };

  const onDeviceTypeSelectionChange = value => updateCreation({ isValid: value.length && name && destination, selectedDeviceTypes: value });

  const onTextInputLeave = value => {
    const possibleDeviceTypeSelection = unionizeStrings(selectedDeviceTypes, [value]);
    updateCreation({
      customDeviceTypes: '',
      isValid: possibleDeviceTypeSelection.length && name && destination,
      selectedDeviceTypes: possibleDeviceTypeSelection
    });
  };

  const onDestinationChange = ({ target: { value } }) =>
    updateCreation({ destination: value, isValid: checkDestinationValidity(value) && selectedDeviceTypes.length && name });

  let onboardingComponent = null;
  let extraOnboardingComponent = null;
  if (!onboardingState.complete && deviceTypeRef.current && releaseNameRef.current) {
    const deviceTypeAnchor = {
      left: deviceTypeRef.current.parentElement.parentElement.offsetLeft + deviceTypeRef.current.parentElement.parentElement.clientWidth,
      top:
        deviceTypeRef.current.parentElement.parentElement.offsetTop +
        deviceTypeRef.current.parentElement.offsetTop +
        deviceTypeRef.current.parentElement.parentElement.clientHeight / 2
    };
    const releaseNameAnchor = {
      left: releaseNameRef.current.parentElement.parentElement.offsetLeft + releaseNameRef.current.parentElement.parentElement.clientWidth,
      top:
        releaseNameRef.current.parentElement.parentElement.offsetTop + releaseNameRef.current.parentElement.offsetTop + releaseNameRef.current.clientHeight / 2
    };
    const destinationAnchor = {
      left: destinationRef.current.parentElement.parentElement.offsetLeft + destinationRef.current.parentElement.parentElement.clientWidth,
      top: destinationRef.current.parentElement.parentElement.offsetTop + destinationRef.current.parentElement.parentElement.clientHeight / 2
    };
    extraOnboardingComponent = getOnboardingComponentFor(
      onboardingSteps.UPLOAD_NEW_ARTIFACT_DIALOG_DESTINATION,
      onboardingState,
      { anchor: destinationAnchor, place: 'right' },
      extraOnboardingComponent
    );
    onboardingComponent = getOnboardingComponentFor(
      onboardingSteps.UPLOAD_NEW_ARTIFACT_DIALOG_RELEASE_NAME,
      onboardingState,
      { anchor: releaseNameAnchor, place: 'right' },
      onboardingComponent
    );
    onboardingComponent = getOnboardingComponentFor(
      onboardingSteps.UPLOAD_NEW_ARTIFACT_DIALOG_DEVICE_TYPE,
      onboardingState,
      { anchor: deviceTypeAnchor, place: 'right' },
      onboardingComponent
    );
  }

  const isValidDestination = checkDestinationValidity(destination);
  return (
    <div className="flexbox column">
      <FileInformation file={file} type={type} onRemove={onRemove} />
      <TextField
        autoFocus={true}
        error={!isValidDestination}
        fullWidth
        helperText={!isValidDestination && <div className="warning">Destination has to be an absolute path</div>}
        inputProps={{ style: { marginTop: 16 } }}
        InputLabelProps={{ shrink: true }}
        label="Destination directory where the file will be installed on your devices"
        onChange={onDestinationChange}
        placeholder="Example: /opt/installed-by-single-file"
        inputRef={destinationRef}
        value={destination}
      />
      <h4>Artifact information</h4>
      <FormControl>
        <InputLabel htmlFor="release-name" style={{ alignItems: 'center', display: 'flex' }}>
          Release name
          <Tooltip key="release-name-tip" title={<ReleaseTooltip />} placement="bottom" arrow leaveDelay={300}>
            <InfoIcon fontSize="small" classes={{ root: 'margin-left-small' }} />
          </Tooltip>
        </InputLabel>
        <Input
          defaultValue={name}
          className="release-name-input"
          id="release-name"
          placeholder="A descriptive name for the software"
          onChange={e => updateCreation({ name: e.target.value })}
          inputRef={releaseNameRef}
        />
      </FormControl>
      <Autocomplete
        id="compatible-device-type-selection"
        // blurOnSelect
        value={selectedDeviceTypes}
        filterSelectedOptions
        freeSolo={true}
        includeInputInList={true}
        multiple
        // allow edits to the textinput without deleting existing device types by ignoring backspace
        onChange={(e, value) => (e.key !== 'Backspace' ? onDeviceTypeSelectionChange(value) : null)}
        onInputChange={(e, v, reason) => onTextInputChange(null, reason)}
        options={deviceTypes}
        renderInput={params => (
          <TextField
            className="device-types-input"
            {...params}
            fullWidth
            inputProps={{
              ...params.inputProps,
              value: customDeviceTypes
            }}
            key="device-types"
            label="Device types compatible"
            onBlur={e => onTextInputLeave(e.target.value)}
            onChange={e => onTextInputChange(e.target.value, 'input')}
            placeholder="Enter all device types this software is compatible with"
            inputRef={deviceTypeRef}
          />
        )}
      />
      {onboardingComponent}
      {extraOnboardingComponent}
    </div>
  );
};

const steps = [ArtifactInformation, VersionInformation];

export const ArtifactInformationForm = ({ activeStep, ...remainder }) => {
  const Component = steps[activeStep];
  return <Component {...remainder} />;
};

export default ArtifactInformationForm;
