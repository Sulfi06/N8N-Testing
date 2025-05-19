# Financial Dashboard

A modern web application that allows users to upload transaction data and receive AI-powered financial insights. The application processes CSV and Excel files, displays transaction data in a table format, and provides AI-generated suggestions based on transaction trends.

## Features

- Upload and process CSV and Excel files
- Interactive data tables and charts
- AI-powered financial insights using GPT
- Comprehensive dashboard with financial metrics
- Modern, responsive UI with Tailwind CSS
- Integration with n8n for workflow automation

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- n8n for workflow automation and GPT integration
- OpenAI API key for GPT analysis

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd financial-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:1234`

## n8n Integration Setup

This application integrates with n8n to process financial data and get AI-powered insights using GPT. To set up the n8n workflow:

1. Install n8n:
```bash
npm install -g n8n
```

2. Start n8n:
```bash
n8n start
```

3. Access the n8n dashboard at http://localhost:5678

4. Follow the detailed setup instructions in the `n8n-workflow-setup.md` file to create the workflow

5. Update the webhook URLs in the application to point to your n8n instance

## Usage

1. Open the application in your web browser
2. Click the "Upload Transaction Data" button
3. Select a CSV or Excel file containing your transaction data
4. Click "Create Dashboard"
5. View the financial dashboard with transaction data, charts, and AI-generated insights

## Sample Data

For testing purposes, you can use the included `sample-transactions.csv` file, which contains mock transaction data covering a 6-month period.

## File Format Requirements

The application expects transaction data in CSV or Excel format with the following recommended columns:
- Date: Transaction date (YYYY-MM-DD format)
- Description: Transaction description
- Amount: Transaction amount (positive for income, negative for expenses)
- Category: Transaction category (e.g., Housing, Food, Transportation)
- Account: Account name (e.g., Checking, Credit Card)

## Development

- Built with React 18
- Styled with Tailwind CSS
- Uses Recharts for data visualization
- Integrates with n8n for workflow automation
- Uses OpenAI GPT for financial analysis

## License

MIT 