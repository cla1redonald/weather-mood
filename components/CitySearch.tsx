'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCities } from '@/lib/weather/geocoding';
import type { GeoLocation } from '@/types/weather';

interface CitySearchProps {
  onCitySelect: (city: GeoLocation) => void;
  defaultCity?: string;
}

export default function CitySearch({ onCitySelect, defaultCity }: CitySearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoLocation[]>([]);
  const [selectedCity, setSelectedCity] = useState<GeoLocation | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectCity = useCallback(
    (city: GeoLocation) => {
      setSelectedCity(city);
      setIsExpanded(false);
      setSuggestions([]);
      setQuery(city.name);
      setError(null);
      onCitySelect(city);
    },
    [onCitySelect]
  );

  // Auto-search if defaultCity is provided
  useEffect(() => {
    if (defaultCity && !selectedCity) {
      setQuery(defaultCity);
      // Trigger automatic search and selection
      const autoSearch = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const results = await searchCities(defaultCity);
          if (results.length > 0) {
            // Auto-select first result
            handleSelectCity(results[0]);
          } else {
            setError('City not found');
          }
        } catch (err: unknown) {
          const errorMessage = (err as Error)?.message || 'Connection error';
          if (errorMessage.includes('Rate limit')) {
            setError('Too many requests. Please wait a moment.');
          } else {
            setError('Connection error. Try again.');
          }
        } finally {
          setIsLoading(false);
        }
      };
      autoSearch();
    }
  }, [defaultCity, selectedCity, handleSelectCity]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !isExpanded) {
      setSuggestions([]);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchCities(query);
        setSuggestions(results);
        setHighlightedIndex(0);
        if (results.length === 0) {
          setError('City not found');
        }
      } catch (err: unknown) {
        const errorMessage = (err as Error)?.message || 'Connection error';
        if (errorMessage.includes('Rate limit')) {
          setError('Too many requests. Please wait a moment.');
        } else {
          setError('Connection error. Try again.');
        }
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isExpanded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        if (suggestions.length > 0) {
          setSuggestions([]);
          setError(null);
        } else {
          setQuery('');
          setError(null);
          inputRef.current?.focus();
        }
        break;
      case 'ArrowDown':
        if (suggestions.length > 0) {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        }
        break;
      case 'ArrowUp':
        if (suggestions.length > 0) {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        }
        break;
      case 'Enter':
        if (suggestions.length > 0) {
          e.preventDefault();
          if (suggestions[highlightedIndex]) {
            handleSelectCity(suggestions[highlightedIndex]);
          }
        }
        break;
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
    setQuery(selectedCity?.name || '');
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-[320px] px-4 md:px-0">
      {isExpanded || !selectedCity ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a city..."
            autoFocus
            className={[
              'w-full px-6 py-3 rounded-full',
              'backdrop-blur-xl',
              'text-white placeholder-white/50',
              'focus:outline-none',
              'transition-all duration-300',
            ].join(' ')}
            style={{
              background: 'rgba(12, 10, 38, 0.4)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: error ? 'rgba(248, 113, 113, 0.6)' : 'rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
            }}
          />

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div
              className="absolute top-full mt-2 w-full backdrop-blur-xl rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(12, 10, 38, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              {suggestions.map((city, index) => (
                <button
                  key={`${city.name}-${city.country}-${index}`}
                  onClick={() => handleSelectCity(city)}
                  className={[
                    'w-full px-6 py-3 text-left text-white transition-colors',
                    index === highlightedIndex ? 'bg-white/20' : 'hover:bg-white/10',
                    index !== suggestions.length - 1 ? 'border-b border-white/10' : '',
                  ].join(' ')}
                >
                  <span className="font-normal">{city.name}</span>
                  <span className="text-white/60 ml-2">{city.country}</span>
                </button>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="absolute top-full mt-2 w-full text-center text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5">
              <div className="w-full h-full border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleExpand}
          className="w-full px-6 py-3 rounded-full backdrop-blur-xl text-white text-center transition-all duration-300 truncate"
          style={{
            background: 'rgba(12, 10, 38, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 300,
            letterSpacing: '0.06em',
            fontSize: '1.1rem',
          }}
          title={`${selectedCity.name}, ${selectedCity.country}`}
        >
          <span className="truncate">
            {selectedCity.name}, {selectedCity.country}
          </span>
        </button>
      )}

      {!selectedCity && query && !isLoading && suggestions.length === 0 && !error && (
        <div className="mt-2 text-center text-white/40 text-xs">
          Type to search...
        </div>
      )}
    </div>
  );
}
