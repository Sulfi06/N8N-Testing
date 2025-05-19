import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [webhookId, setWebhookId] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);

  // URLs for n8n webhooks - using the provided webhook URL
  const N8N_SEND_WEBHOOK_URL = 'https://sulfi06.app.n8n.cloud/webhook/transaction-upload';
  const N8N_RESULT_WEBHOOK_URL = 'http://localhost:5678/webhook/result';

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setShowDashboard(false);
    setInsights(null);
    setData(null);

    try {
      if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
          complete: (results) => {
            setRawData(results.data);
            setLoading(false);
          },
          header: true,
          error: (error) => {
            setError('Error parsing CSV file: ' + error.message);
            setLoading(false);
          }
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            setRawData(jsonData);
          } catch (err) {
            setError('Error processing Excel file: ' + err.message);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsBinaryString(file);
      } else {
        setError('Please upload a CSV or Excel file');
        setLoading(false);
      }
    } catch (err) {
      setError('Error processing file: ' + err.message);
      setLoading(false);
    }
  };

  const sendDataToN8n = async (data) => {
    try {
      const response = await fetch(N8N_SEND_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({
          data: data
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // For this webhook, we'll wait for a direct response rather than polling
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending data to n8n:', error);
      throw error;
    }
  };

  const pollForResults = async (executionId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${N8N_RESULT_WEBHOOK_URL}?executionId=${executionId}`, {
          method: 'GET',
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.status === 'completed') {
            clearInterval(interval);
            setPollingInterval(null);
            handleAnalysisResults(result);
          }
        }
      } catch (error) {
        console.error('Error polling for results:', error);
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);
  };

  const handleAnalysisResults = (result) => {
    if (!result.data) {
      setError('No analysis results returned');
      setLoading(false);
      return;
    }

    const { insights, chartData } = result.data;
    
    setData(rawData);
    setInsights(insights);
    setShowDashboard(true);
    setLoading(false);
  };

  const processData = async () => {
    if (!rawData || rawData.length === 0) {
      setError('No data to process');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Attempt to send data to n8n webhook
      try {
        const result = await sendDataToN8n(rawData);
        
        // If we got a result directly from the webhook
        if (result && result.data) {
          handleAnalysisResults(result);
          return;
        }
      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
        setError('Request could not be processed');
        setLoading(false);
        return;
      }
      
      // Fallback to local data processing if webhook fails
      console.log("Using fallback local processing");
      
      // Calculate basic metrics
      let totalIncome = 0;
      let totalExpenses = 0;
      let categoryMap = {};
      
      rawData.forEach(transaction => {
        const amount = parseFloat(transaction.Amount || transaction.amount || 0);
        const category = transaction.Category || transaction.category || 'Uncategorized';
        
        if (amount > 0) {
          totalIncome += amount;
        } else {
          totalExpenses += Math.abs(amount);
          
          // Track expense categories
          if (!categoryMap[category]) {
            categoryMap[category] = 0;
          }
          categoryMap[category] += Math.abs(amount);
        }
      });
      
      // Find top expense category
      let topExpenseCategory = 'None';
      let maxAmount = 0;
      Object.entries(categoryMap).forEach(([category, amount]) => {
        if (amount > maxAmount) {
          maxAmount = amount;
          topExpenseCategory = category;
        }
      });
      
      const netCashFlow = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0;
      
      // Set the data and insights
      setData(rawData);
      const localInsights = {
        summary: "Based on your transaction data, your financial health appears to be in good standing with a positive cash flow. Your income exceeds your expenses, allowing for savings and potential investments.",
        suggestions: [
          `Consider allocating more to savings, as your current rate of ${savingsRate}% is healthy`,
          `Review your spending in ${topExpenseCategory}, which is your highest expense category`,
          "Create a budget for discretionary spending to maintain financial stability",
          "Consider setting up automatic transfers to a dedicated emergency fund"
        ],
        metrics: {
          totalIncome: totalIncome,
          totalExpenses: totalExpenses,
          netCashFlow: netCashFlow,
          savingsRate: savingsRate,
          topExpenseCategory: topExpenseCategory
        }
      };
      
      setInsights(localInsights);
      setShowDashboard(true);
      setLoading(false);
    } catch (err) {
      setError('Error processing financial data: ' + err.message);
      setLoading(false);
    }
  };

  const handleClear = () => {
    setData(null);
    setRawData(null);
    setInsights(null);
    setError(null);
    setShowDashboard(false);
    setWebhookId(null);
    // Clear any polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Generate chart data based on transactions
  const getIncomeExpenseData = () => {
    if (!insights || !insights.metrics) return [];
    
    // If real data is available from insights, use it
    if (insights.chartData && insights.chartData.monthlyTrends) {
      return insights.chartData.monthlyTrends;
    }
    
    // Otherwise use mock data
    return [
      { name: 'Jan', income: 4000, expenses: 2400 },
      { name: 'Feb', income: 3000, expenses: 1398 },
      { name: 'Mar', income: 2000, expenses: 9800 },
      { name: 'Apr', income: 2780, expenses: 3908 },
      { name: 'May', income: 1890, expenses: 4800 },
      { name: 'Jun', income: 2390, expenses: 3800 },
    ];
  };

  const getCategoryData = () => {
    if (!insights || !insights.metrics) return [];
    
    // If real data is available from insights, use it
    if (insights.chartData && insights.chartData.expensesByCategory) {
      return insights.chartData.expensesByCategory;
    }
    
    // Otherwise use mock data
    return [
      { name: 'Housing', value: 35 },
      { name: 'Food', value: 20 },
      { name: 'Transportation', value: 15 },
      { name: 'Utilities', value: 10 },
      { name: 'Entertainment', value: 10 },
      { name: 'Other', value: 10 },
    ];
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
        <p className="text-gray-600">Upload your transaction data for AI-powered insights</p>
      </header>

      <div className="mb-8">
        <div className="max-w-xl">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Transaction Data
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        
        <div className="mt-4 flex space-x-4">
          {rawData && !showDashboard && (
            <button
              onClick={processData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Dashboard
            </button>
          )}
          
          {(rawData || showDashboard) && (
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-2 text-gray-600">
            {webhookId ? 'Analyzing your financial data with AI...' : 'Processing your data...'}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {showDashboard && data && insights && (
        <div className="space-y-6">
          {/* Summary metrics cards */}
          {insights.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Income</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${insights.metrics.totalIncome?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Expenses</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${insights.metrics.totalExpenses?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Net Cash Flow</h3>
                <p className={`text-2xl font-bold ${(insights.metrics.netCashFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(insights.metrics.netCashFlow || 0).toLocaleString()}
                  {(insights.metrics.netCashFlow || 0) >= 0 ? ' +' : ' -'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Savings Rate</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {insights.metrics.savingsRate || '0'}%
                </p>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Income vs. Expenses</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getIncomeExpenseData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="income" fill="#4F46E5" />
                    <Bar dataKey="expenses" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Expense Categories</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getCategoryData()}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getCategoryData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Transaction Overview</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      {Object.keys(data[0]).map((header) => (
                        <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.length > 5 && (
                <div className="mt-4 text-sm text-gray-500">
                  Showing 5 of {data.length} transactions
                </div>
              )}
            </div>

            {insights && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">AI Insights</h2>
                <div className="space-y-4">
                  <p className="text-gray-700">{insights.summary}</p>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Suggestions:</h3>
                    <ul className="list-disc list-inside space-y-2">
                      {insights.suggestions.map((suggestion, index) => (
                        <li key={index} className="text-gray-600">{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 