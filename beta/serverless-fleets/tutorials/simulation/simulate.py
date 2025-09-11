import sys
import os
import numpy as np
import yfinance as yf

def monte_carlo_simulation(ticker):
  # Fetch historical data for a stock
  data = yf.download(ticker, start="2024-01-01", end="2025-01-01", auto_adjust=True, progress=False)
  returns = data['Close'].pct_change().dropna()

  # Simulate future returns using Monte Carlo
  num_simulations = 100000
  simulation_horizon = 252  # Number of trading days in a year
  stddev = np.std(returns, axis=0)
  simulated_returns = np.random.normal(np.mean(returns, axis=0), stddev, (simulation_horizon, num_simulations))

  # Calculate the simulated portfolio values
  initial_investment = 1000000  # $1,000,000
  portfolio_values = initial_investment * np.exp(np.cumsum(simulated_returns, axis=0))

  # Calculate the portfolio returns
  portfolio_returns = portfolio_values[-1] / portfolio_values[0] - 1

  # Calculate the VaR at 99.5% confidence level
  confidence_level = 0.995
  VaR = np.percentile(portfolio_returns, (1 - confidence_level) * 100)
  return (ticker, VaR, stddev.iloc[0])

def print_usage():
  print("usage: python3 simulate.py <TICKER_FILE> <RESULT_FOLDER>")
  print("")
  print("   TICKER         : stock ticker" )
  print("   RESULT_FOLDER  : folder of the results")
  print("")
  sys.exit(-1)


if __name__ == "__main__":

  if len(sys.argv) != 3:
    print_usage()
 
  TICKER = sys.argv[1]
  RESULT_FOLDER = sys.argv[2]

  (ticker, VaR, stddev) = monte_carlo_simulation(TICKER)

  print("VaR of ticker %s: %s (%s)" % (ticker, VaR, stddev) )

  filename="%s/ticker_%s.result" % (RESULT_FOLDER,TICKER)
  with open(filename, "w+") as f:
    f.write("Ticker,VaR,STDEV\n")
    f.write("%s,%.2f,%.2f\n" % (ticker,VaR,stddev))

