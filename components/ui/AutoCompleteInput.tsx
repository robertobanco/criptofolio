import React, { useState, useEffect, useRef } from 'react';

interface AutoCompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}

const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({ value, onChange, suggestions, placeholder }) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isValid = value === '' || suggestions.map(s => s.toUpperCase()).includes(value.toUpperCase());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const userInput = e.currentTarget.value;
    const upperCaseInput = userInput.toUpperCase();
    
    const filtered = suggestions.filter(
      suggestion => suggestion.toUpperCase().indexOf(upperCaseInput) > -1
    );

    onChange(userInput);
    setFilteredSuggestions(filtered);
    setShowSuggestions(true);
    setActiveSuggestionIndex(0);
  };

  const handleClick = (suggestion: string) => {
    onChange(suggestion);
    setFilteredSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (showSuggestions && filteredSuggestions.length > 0 && filteredSuggestions[activeSuggestionIndex]) {
        e.preventDefault();
        handleClick(filteredSuggestions[activeSuggestionIndex]);
      } else {
        setShowSuggestions(false);
      }
    } else if (e.key === 'ArrowUp') {
      if (activeSuggestionIndex === 0) return;
      setActiveSuggestionIndex(activeSuggestionIndex - 1);
    } else if (e.key === 'ArrowDown') {
      if (activeSuggestionIndex === filteredSuggestions.length - 1) return;
      setActiveSuggestionIndex(activeSuggestionIndex + 1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const suggestionsListComponent = (
    <ul className="absolute z-50 w-full bg-gray-900 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
      {filteredSuggestions.length > 0 ? (
        filteredSuggestions.map((suggestion, index) => (
          <li
            className={`p-2 cursor-pointer hover:bg-indigo-600 ${index === activeSuggestionIndex ? 'bg-indigo-600' : ''}`}
            key={suggestion}
            onClick={() => handleClick(suggestion)}
          >
            {suggestion}
          </li>
        ))
      ) : (
        <li className="p-2 text-gray-500">Nenhum resultado encontrado</li>
      )}
    </ul>
  );

  return (
    <div 
      className="relative" 
      ref={wrapperRef}
      title={!isValid ? "Ativo não encontrado na base de dados da CoinMarketCap." : ""}
    >
      <input
        type="text"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        value={value}
        placeholder={placeholder}
        className={`bg-gray-900 border rounded p-2 w-full text-sm focus:outline-none focus:ring-2 ${
          !isValid
            ? 'border-red-500 text-red-400 focus:ring-red-500'
            : 'border-gray-600 focus:ring-indigo-500'
        }`}
        autoComplete="off"
        onFocus={handleChange}
      />
      {showSuggestions && value && suggestionsListComponent}
    </div>
  );
};

export default AutoCompleteInput;