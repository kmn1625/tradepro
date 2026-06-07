import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import PaperTrading from './PaperTrading';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PaperTrading', () => {
  test('renders "No strategy selected" when no strategyId', () => {
    render(<PaperTrading />);
    expect(screen.getByText('No strategy selected.')).toBeInTheDocument();
  });

  test('renders "No portfolio yet" on 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }));
    render(<PaperTrading strategyId="strat-abc" />);
    await waitFor(() => {
      expect(screen.getByText(/No portfolio yet for strategy:/)).toBeInTheDocument();
    });
  });

  test('renders error message on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<PaperTrading strategyId="strat-abc" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load portfolio/)).toBeInTheDocument();
    });
  });

  test('renders portfolio stats on successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        availableCapital: 950000,
        capital: 1000000,
        realized: 5000,
        unrealized: -2000,
        total: 3000,
        positions: [],
        tradeCount: 3,
      }),
    }));
    render(<PaperTrading strategyId="strat-abc" />);
    await waitFor(() => {
      expect(screen.getByText('Available Capital')).toBeInTheDocument();
    });
    expect(screen.getByText('3 trades completed')).toBeInTheDocument();
  });

  test('renders "No open positions" row when positions array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        availableCapital: 1000000, capital: 1000000,
        realized: 0, unrealized: 0, total: 0, positions: [], tradeCount: 0,
      }),
    }));
    render(<PaperTrading strategyId="strat-abc" />);
    await waitFor(() => {
      expect(screen.getByText('No open positions')).toBeInTheDocument();
    });
  });

  test('renders position row for each position returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        availableCapital: 800000, capital: 1000000,
        realized: 0, unrealized: 1000, total: 1000,
        positions: [{ symbol: 'NIFTY 50', qty: 5, avgCost: 22000, totalCost: 110000 }],
        tradeCount: 1,
      }),
    }));
    render(<PaperTrading strategyId="strat-abc" />);
    await waitFor(() => {
      expect(screen.getByText('NIFTY 50')).toBeInTheDocument();
    });
  });
});
