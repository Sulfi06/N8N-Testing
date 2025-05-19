# Setting up the n8n Workflow for Financial Dashboard

This document provides instructions for setting up the n8n workflow that integrates with our Financial Dashboard application.

## Prerequisites

1. n8n installed and running (can be installed via npm, Docker, or desktop app)
2. OpenAI API key for GPT integration

## n8n Setup

1. Install n8n if you haven't already:
   ```bash
   npm install -g n8n
   ```

2. Start n8n:
   ```bash
   n8n start
   ```

3. Access the n8n dashboard at http://localhost:5678

## Creating the Financial Data Analysis Workflow

### Step 1: Create the Webhook Trigger

1. Click on "Create new workflow" in the n8n dashboard
2. Name it "Financial Data Analysis"
3. Add a Webhook node as the trigger:
   - Click the "+" button to add a node
   - Search for "Webhook" and select it
   - Configure as follows:
     - Authentication: None
     - HTTP Method: POST
     - Path: financial-data
     - Response Mode: Last Node

4. Click "Execute Node" to activate the webhook and get the webhook URL

### Step 2: Add Data Processing Nodes

1. Add a Function node to process and prepare the transaction data:
   - Click the "+" button after the Webhook node
   - Search for "Function" and select it
   - Configure as follows:
     - Function Name: Process Transaction Data
     - Code:
     ```javascript
     // Get the data from the webhook
     const inputData = $input.item.json.data;
     
     if (!Array.isArray(inputData) || inputData.length === 0) {
       return { error: "Invalid data format" };
     }
     
     // Calculate basic metrics
     let totalIncome = 0;
     let totalExpenses = 0;
     let categories = {};
     let monthlyData = {};
     
     // Process each transaction
     inputData.forEach(transaction => {
       // Assuming there's an amount field and negative values are expenses
       const amount = parseFloat(transaction.Amount || transaction.amount || 0);
       const category = transaction.Category || transaction.category || 'Uncategorized';
       const date = new Date(transaction.Date || transaction.date || new Date());
       const month = date.toLocaleString('en-US', { month: 'short' });
       
       if (amount > 0) {
         totalIncome += amount;
       } else {
         totalExpenses += Math.abs(amount);
       }
       
       // Track categories
       if (amount < 0) { // Only for expenses
         categories[category] = (categories[category] || 0) + Math.abs(amount);
       }
       
       // Track monthly data
       if (!monthlyData[month]) {
         monthlyData[month] = { income: 0, expenses: 0 };
       }
       
       if (amount > 0) {
         monthlyData[month].income += amount;
       } else {
         monthlyData[month].expenses += Math.abs(amount);
       }
     });
     
     // Format for charts
     const expensesByCategory = Object.entries(categories).map(([name, value]) => ({
       name,
       value: Math.round((value / totalExpenses) * 100) // As percentage
     }));
     
     const monthlyTrends = Object.entries(monthlyData).map(([name, data]) => ({
       name,
       income: Math.round(data.income),
       expenses: Math.round(data.expenses)
     }));
     
     // Calculate metrics
     const netCashFlow = totalIncome - totalExpenses;
     const savingsRate = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0;
     
     // Find top expense category
     let topExpenseCategory = 'None';
     let maxExpense = 0;
     
     Object.entries(categories).forEach(([category, amount]) => {
       if (amount > maxExpense) {
         maxExpense = amount;
         topExpenseCategory = category;
       }
     });
     
     // Prepare data for GPT analysis
     const metricsForGPT = {
       totalIncome,
       totalExpenses,
       netCashFlow,
       savingsRate,
       topExpenseCategory,
       transactionCount: inputData.length
     };
     
     // Return processed data
     return {
       json: {
         rawData: inputData,
         metrics: {
           totalIncome,
           totalExpenses,
           netCashFlow,
           savingsRate,
           topExpenseCategory
         },
         chartData: {
           expensesByCategory,
           monthlyTrends
         },
         metricsForGPT
       }
     };
     ```

### Step 3: Add the OpenAI GPT Integration

1. Add an OpenAI node to generate insights:
   - Click the "+" button after the Function node
   - Search for "OpenAI" and select it
   - Configure as follows:
     - Operation: Chat
     - Model: gpt-4 (or gpt-3.5-turbo if preferred)
     - Messages: 
       - Role: system
       - Content: 
       ```
       You are a financial analyst AI assistant. You will analyze transaction data and provide valuable financial insights and suggestions to help users improve their financial health. Focus on providing practical, actionable advice.
       ```
       - Add Message:
         - Role: user
         - Content: 
         ```
         Please analyze the following financial data and provide:
         1. A summary paragraph of the financial health (2-3 sentences)
         2. A list of 3-5 specific, actionable suggestions based on the data
         
         The metrics are:
         - Total Income: {{$node["Process Transaction Data"].json["metrics"]["totalIncome"]}}
         - Total Expenses: {{$node["Process Transaction Data"].json["metrics"]["totalExpenses"]}}
         - Net Cash Flow: {{$node["Process Transaction Data"].json["metrics"]["netCashFlow"]}}
         - Savings Rate: {{$node["Process Transaction Data"].json["metrics"]["savingsRate"]}}%
         - Top Expense Category: {{$node["Process Transaction Data"].json["metrics"]["topExpenseCategory"]}}
         - Number of Transactions: {{$node["Process Transaction Data"].json["metricsForGPT"]["transactionCount"]}}
         
         Format your response as a JSON object with the following structure:
         {
           "summary": "Your financial health summary...",
           "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
         }
         Only return valid JSON, no extra text.
         ```
     - API Key: Your OpenAI API Key (create a credential)

### Step 4: Process the GPT Response

1. Add a Function node to combine the analysis with metrics:
   - Click the "+" button after the OpenAI node
   - Search for "Function" and select it
   - Configure as follows:
     - Function Name: Combine Results
     - Code:
     ```javascript
     // Get the GPT analysis
     let gptResponse = $input.item.json.text;
     
     // Try to parse the JSON response from GPT
     let insights;
     try {
       // Handle potential leading/trailing characters sometimes returned by GPT
       if (gptResponse.startsWith('```json')) {
         gptResponse = gptResponse.replace(/```json\n|\n```/g, '');
       }
       insights = JSON.parse(gptResponse);
     } catch (error) {
       // If parsing fails, create a fallback object
       insights = {
         summary: "Based on your transaction data, we've analyzed your financial situation.",
         suggestions: [
           "Review your transaction history for patterns",
           "Consider tracking expenses by category",
           "Look for opportunities to increase savings"
         ]
       };
     }
     
     // Get the metrics and chart data from the previous node
     const { metrics, chartData } = $node["Process Transaction Data"].json;
     
     // Combine everything for the final response
     return {
       json: {
         status: "completed",
         data: {
           insights: {
             ...insights,
             metrics
           },
           chartData
         }
       }
     };
     ```

### Step 5: Add the Result Webhook for Polling

1. Add a Webhook node for the client to poll for results:
   - Click the "+" button to add a new node
   - Search for "Webhook" and select it
   - Configure as follows:
     - Authentication: None
     - HTTP Method: GET
     - Path: result
     - Response Mode: Last Node
     - Add Parameter:
       - Name: executionId
       - Required: true

2. Connect this node to the "Combine Results" node

### Step 6: Save and Activate the Workflow

1. Click the "Save" button to save the workflow
2. Toggle the "Active" switch in the top-right to activate the workflow

## Update the React Application

1. Update the N8N_SEND_WEBHOOK_URL and N8N_RESULT_WEBHOOK_URL constants in App.js with the actual webhook URLs from n8n:
   ```javascript
   const N8N_SEND_WEBHOOK_URL = 'http://localhost:5678/webhook/financial-data';
   const N8N_RESULT_WEBHOOK_URL = 'http://localhost:5678/webhook/result';
   ```

## Testing the Integration

1. Start your React application
2. Upload a CSV or Excel file with financial transaction data
3. Click "Create Dashboard"
4. The application should send the data to n8n, which will process it, analyze it with GPT, and return the results
5. If successful, you'll see the dashboard with financial insights and AI-generated suggestions

## Troubleshooting

- If the webhooks aren't working, make sure n8n is running and the webhooks are properly activated
- Check the n8n execution logs for any errors
- For local development, you may need to use a tool like ngrok to expose your local n8n instance to the internet if your React app is hosted elsewhere 