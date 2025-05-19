# Deploying the Financial Dashboard to Vercel

This document provides instructions for deploying the Financial Dashboard application to Vercel.

## Prerequisites

1. A [Vercel](https://vercel.com/) account
2. [Git](https://git-scm.com/) installed on your local machine
3. The [Vercel CLI](https://vercel.com/docs/cli) (optional)

## Deployment Steps

### Method 1: Using the Vercel Dashboard (Recommended for First-Time Deployment)

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Log in to your Vercel account

3. Click on "Add New..." → "Project"

4. Import your Git repository

5. Configure the project:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

6. Click "Deploy"

### Method 2: Using the Vercel CLI

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to your project directory:
   ```bash
   cd path/to/financial-dashboard
   ```

3. Log in to Vercel:
   ```bash
   vercel login
   ```

4. Deploy the project:
   ```bash
   vercel
   ```

5. Follow the interactive prompts

## Updating the n8n Webhook URL

After deploying to Vercel, update the webhook URL in your application if needed:

1. Go to the Vercel dashboard and copy your deployment URL (e.g., `https://financial-dashboard.vercel.app`)

2. In your `src/App.js` file, update the webhook URLs if necessary:
   ```javascript
   const N8N_SEND_WEBHOOK_URL = 'https://sulfi06.app.n8n.cloud/webhook-test/92e64812-3aab-478a-9c66-466f54d5cd2d';
   ```

3. Push the changes to your Git repository or redeploy using the Vercel CLI

## Testing the Integration

1. Open your deployed application using the Vercel URL
2. Upload a CSV or Excel file with financial transaction data
3. Click "Create Dashboard"
4. The application should now be able to send the data to your n8n webhook without CORS issues

## Troubleshooting

- If you encounter any issues with the n8n integration, check the browser console for error messages
- Ensure your n8n webhook is accessible from the internet
- Verify that the webhook URL in your application is correct
- Check that your n8n workflow is properly configured to receive and process the data 