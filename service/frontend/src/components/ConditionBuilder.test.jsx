import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import ConditionBuilder from './ConditionBuilder';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      indicators: ['RSI', 'MACD', 'EMA', 'SMA'],
      operators: ['crossesAbove', 'crossesBelow', 'greaterThan', 'lessThan'],
    }),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderSettled(ui) {
  let result;
  await act(async () => { result = render(ui); });
  return result;
}

describe('ConditionBuilder', () => {
  test('renders AI Strategy Parser section', async () => {
    await renderSettled(<ConditionBuilder />);
    expect(screen.getByText('AI Strategy Parser')).toBeInTheDocument();
  });

  test('renders Entry and Exit condition sections', async () => {
    await renderSettled(<ConditionBuilder />);
    expect(screen.getByText('Entry Conditions')).toBeInTheDocument();
    expect(screen.getByText('Exit Conditions')).toBeInTheDocument();
  });

  test('renders Condition JSON preview', async () => {
    await renderSettled(<ConditionBuilder />);
    expect(screen.getByText('Condition JSON')).toBeInTheDocument();
  });

  test('Parse with AI button is disabled when input is empty', async () => {
    await renderSettled(<ConditionBuilder />);
    expect(screen.getByText('Parse with AI')).toBeDisabled();
  });

  test('Parse with AI button enables when text is typed', async () => {
    await renderSettled(<ConditionBuilder />);
    const textarea = screen.getByPlaceholderText(/Describe your strategy/);
    fireEvent.change(textarea, { target: { value: 'Buy when RSI < 30' } });
    expect(screen.getByText('Parse with AI')).not.toBeDisabled();
  });

  test('calls onChange with entry and exit shape on mount', async () => {
    const onChange = vi.fn();
    await renderSettled(<ConditionBuilder onChange={onChange} />);
    expect(onChange).toHaveBeenCalled();
    const condition = onChange.mock.calls[0][0];
    expect(condition).toHaveProperty('entry');
    expect(condition).toHaveProperty('exit');
  });

  test('Add button in Entry Conditions adds a new leg', async () => {
    const onChange = vi.fn();
    await renderSettled(<ConditionBuilder onChange={onChange} />);
    const addButtons = screen.getAllByText('Add');
    await act(async () => { fireEvent.click(addButtons[0]); });
    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.entry).toHaveProperty('AND');
      expect(lastCall.entry.AND).toHaveLength(2);
    });
  });
});
