export const customSelectStyles = {
  container: (base) => ({
    ...base,
    width: '100%',
    minWidth: '0',
  }),
  control: (base, state) => ({
    ...base,
    width: '100%',
    minWidth: '0',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(2px)',
    border: state.isFocused ? '2px solid #621f32' : '1px solid #e5e7eb',
    borderRadius: '1rem',
    boxShadow: state.isFocused
      ? '0 10px 25px -5px rgba(98, 31, 50, 0.1)'
      : 'none',
    minHeight: '42px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      border: '2px solid rgba(98, 31, 50, 0.5)',
      backgroundColor: '#fff',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 12px',
    gap: '4px',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#621f32',
    borderRadius: '0.5rem',
    padding: '1px 2px',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 6px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      color: '#ffffff',
      borderRadius: '0 0.5rem 0.5rem 0',
    },
  }),
  option: (base, state) => ({
    ...base,
    fontSize: '12px',
    fontWeight: '700',
    backgroundColor: state.isSelected
      ? '#621f32'
      : state.isFocused
        ? 'rgba(98, 31, 50, 0.05)'
        : 'transparent',
    color: state.isSelected ? '#ffffff' : '#374151',
    cursor: 'pointer',
    padding: '12px 16px',
    transition: 'all 0.2s ease',
    '&:active': {
      backgroundColor: '#621f32',
      color: '#ffffff',
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '1.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
    border: '1px solid #f3f4f6',
    width: '320px', // Menú más ancho que la columna para mejor visibilidad
    zIndex: 999999,
    animation: 'fadeIn 0.2s ease-out',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 999999 }),
  placeholder: (base) => ({ ...base, color: '#9ca3af', fontWeight: '600' }),
  singleValue: (base) => ({ ...base, color: '#374151' }),
  input: (base) => ({ ...base, fontSize: '11px' }),
  dropdownIndicator: (base) => ({
    ...base,
    color: '#9ca3af',
    '&:hover': { color: '#621f32' },
  }),
  indicatorSeparator: () => ({ display: 'none' }),
};

export const headerSelectStyles = {
  container: (base) => ({
    ...base,
    width: '100%',
    minWidth: '0',
  }),
  control: (base, state) => ({
    ...base,
    width: '100%',
    minWidth: '0',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: state.isFocused ? '1.5px solid #bc955c' : '1px solid rgba(188, 149, 92, 0.35)',
    borderRadius: '0.5rem',
    boxShadow: 'none',
    minHeight: '28px',
    height: '28px',
    fontSize: '9px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      border: '1px solid #bc955c',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0px 8px',
    gap: '2px',
    height: '26px',
    minHeight: '26px',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'rgba(98, 31, 50, 0.85)',
    border: '1px solid rgba(188, 149, 92, 0.4)',
    borderRadius: '0.25rem',
    padding: '0px',
    margin: '1px',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#ffffff',
    fontSize: '8px',
    fontWeight: '700',
    padding: '1px 4px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '0px 2px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      color: '#ffffff',
      borderRadius: '0 0.25rem 0.25rem 0',
    },
  }),
  option: (base, state) => ({
    ...base,
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: state.isSelected
      ? '#bc955c'
      : state.isFocused
        ? 'rgba(188, 149, 92, 0.15)'
        : 'transparent',
    color: state.isSelected ? '#3e131f' : '#e5e7eb',
    cursor: 'pointer',
    padding: '8px 12px',
    transition: 'all 0.15s ease',
    '&:active': {
      backgroundColor: '#bc955c',
      color: '#3e131f',
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    border: '1px solid rgba(188, 149, 92, 0.3)',
    backgroundColor: '#2b0d15',
    width: '260px',
    zIndex: 999999,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 999999 }),
  placeholder: (base) => ({ ...base, color: 'rgba(255, 255, 255, 0.45)', fontWeight: '500' }),
  singleValue: (base) => ({ ...base, color: '#ffffff' }),
  input: (base) => ({ ...base, fontSize: '9px', color: '#ffffff', margin: '0px' }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'rgba(255, 255, 255, 0.4)',
    padding: '2px',
    '&:hover': { color: '#bc955c' },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgba(255, 255, 255, 0.4)',
    padding: '2px',
    '&:hover': { color: '#bc955c' },
  }),
  indicatorSeparator: () => ({ display: 'none' }),
};
