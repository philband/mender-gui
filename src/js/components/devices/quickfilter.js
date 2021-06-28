import React, { useEffect, useState } from 'react';

import { MenuItem, Select, TextField } from '@material-ui/core';

let timer;

export const QuickFilter = ({ attributes, onChange, resetTrigger }) => {
  const [filterValue, setFilterValue] = useState('');
  const [selectedAttribute, setSelectedAttribute] = useState('id');

  useEffect(() => {
    if (!(filterValue && selectedAttribute)) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => onChange(filterValue, selectedAttribute), 700);
    return () => {
      clearTimeout(timer);
    };
  }, [selectedAttribute, filterValue]);

  useEffect(() => {
    setFilterValue('');
  }, [resetTrigger]);

  const onSearchChange = ({ target: { value } }) => setFilterValue(value);

  const onSelectionChange = ({ target: { value } }) => setSelectedAttribute(value);

  return (
    <div>
      Quick find Device
      <Select className="margin-left-small" disableUnderline onChange={onSelectionChange} value={selectedAttribute} style={{ fontSize: 13 }}>
        {attributes.map(attribute => (
          <MenuItem key={attribute.key} value={attribute.key}>
            {attribute.value}
          </MenuItem>
        ))}
      </Select>
      <TextField placeholder="Filter" className="search" value={filterValue} onChange={onSearchChange} style={{ marginLeft: 30, marginTop: 0 }} />
    </div>
  );
};

export default QuickFilter;
