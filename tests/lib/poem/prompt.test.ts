import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage } from '@/lib/poem/prompt';
import type { PoemInput } from '@/lib/poem/prompt';

describe('poem prompt', () => {
  describe('buildSystemPrompt', () => {
    it('returns a non-empty string', () => {
      const prompt = buildSystemPrompt();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('instructs 4-6 lines of free verse', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('4-6 lines');
      expect(prompt).toContain('free verse');
    });

    it('tells the model not to include a title', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('not include a title');
    });

    it('emphasizes sensory details', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('sensory');
    });

    it('warns against cliches', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('cliche');
    });
  });

  describe('buildUserMessage', () => {
    const baseInput: PoemInput = {
      city: 'London',
      temperature: 8,
      condition: 'rain',
      humidity: 85,
      windSpeed: 20,
    };

    it('includes the city name', () => {
      const message = buildUserMessage(baseInput);
      expect(message).toContain('London');
    });

    it('includes the temperature with units', () => {
      const message = buildUserMessage(baseInput);
      expect(message).toContain('8°C');
    });

    it('includes the weather condition', () => {
      const message = buildUserMessage(baseInput);
      expect(message).toContain('rain');
    });

    it('includes humidity percentage', () => {
      const message = buildUserMessage(baseInput);
      expect(message).toContain('85%');
    });

    it('includes wind speed with units', () => {
      const message = buildUserMessage(baseInput);
      expect(message).toContain('20 km/h');
    });

    it('works with different cities and conditions', () => {
      const input: PoemInput = {
        city: 'Tokyo',
        temperature: 32,
        condition: 'clear',
        humidity: 45,
        windSpeed: 5,
      };
      const message = buildUserMessage(input);
      expect(message).toContain('Tokyo');
      expect(message).toContain('32°C');
      expect(message).toContain('clear');
      expect(message).toContain('45%');
      expect(message).toContain('5 km/h');
    });

    it('handles negative temperatures', () => {
      const input: PoemInput = {
        city: 'Moscow',
        temperature: -15,
        condition: 'snow',
        humidity: 70,
        windSpeed: 30,
      };
      const message = buildUserMessage(input);
      expect(message).toContain('-15°C');
    });
  });
});
