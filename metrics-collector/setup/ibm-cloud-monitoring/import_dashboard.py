#!/usr/bin/env python3
"""
IBM Cloud Monitoring Dashboard Import/Update Script

This script creates or updates Sysdig dashboards in IBM Cloud Monitoring using IBM Cloud IAM authentication.
It uses an IBM Cloud IAM API key to obtain an access token, then interacts with the Sysdig API.

Usage:
    python import_dashboard.py --iam-api-key <IAM_API_KEY> --instance-id <INSTANCE_ID> --region <REGION> --dashboard <DASHBOARD_JSON>

Environment Variables:
    IBM_CLOUD_IAM_API_KEY: IBM Cloud IAM API key (alternative to --iam-api-key)
    SYSDIG_INSTANCE_ID: IBM Cloud Monitoring instance ID (alternative to --instance-id)
    SYSDIG_REGION: IBM Cloud Monitoring region (alternative to --region)

Example:
    python import_dashboard.py \\
        --iam-api-key YOUR_IAM_API_KEY \\
        --instance-id YOUR_INSTANCE_ID \\
        --region us-south \\
        --dashboard code-engine-overview.json
"""

import argparse
import json
import os
import sys
from typing import Dict, Optional

try:
    import requests
except ImportError:
    print("Error: 'requests' module not found. Install it with: pip install requests")
    sys.exit(1)


class IBMCloudIAMAuth:
    """Handles IBM Cloud IAM authentication."""
    
    IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"
    
    def __init__(self, iam_api_key: str):
        """
        Initialize IBM Cloud IAM authentication.
        
        Args:
            iam_api_key: IBM Cloud IAM API key
        """
        self.iam_api_key = iam_api_key
        self._access_token = None
        self._token_expiry = 0
    
    def get_access_token(self) -> str:
        """
        Get an IBM Cloud IAM access token.
        
        Returns:
            IAM access token
        """
        print("Obtaining IBM Cloud IAM access token...")
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        
        data = {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": self.iam_api_key
        }
        
        try:
            response = requests.post(
                self.IAM_TOKEN_URL,
                headers=headers,
                data=data,
                timeout=30
            )
            response.raise_for_status()
            token_data = response.json()
            self._access_token = token_data.get("access_token")
            
            if not self._access_token:
                raise ValueError("No access token in IAM response")
            
            print("✓ IAM access token obtained successfully")
            return self._access_token
            
        except requests.exceptions.RequestException as e:
            print(f"Error obtaining IAM token: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            raise


class SysdigDashboardManager:
    """Manages Sysdig dashboard creation and updates via REST API with IBM Cloud IAM authentication."""
    
    # IBM Cloud Monitoring regional endpoints
    REGION_ENDPOINTS = {
        "us-south": "https://us-south.monitoring.cloud.ibm.com",
        "us-east": "https://us-east.monitoring.cloud.ibm.com",
        "eu-de": "https://eu-de.monitoring.cloud.ibm.com",
        "eu-es": "https://eu-es.monitoring.cloud.ibm.com",
        "eu-gb": "https://eu-gb.monitoring.cloud.ibm.com",
        "jp-tok": "https://jp-tok.monitoring.cloud.ibm.com",
        "au-syd": "https://au-syd.monitoring.cloud.ibm.com",
        "jp-osa": "https://jp-osa.monitoring.cloud.ibm.com",
        "ca-tor": "https://ca-tor.monitoring.cloud.ibm.com",
        "br-sao": "https://br-sao.monitoring.cloud.ibm.com",
    }
    
    def __init__(self, iam_auth: IBMCloudIAMAuth, instance_id: str, region: str):
        """
        Initialize the Sysdig Dashboard Manager.
        
        Args:
            iam_auth: IBM Cloud IAM authentication handler
            instance_id: IBM Cloud Monitoring instance ID (GUID)
            region: IBM Cloud region (e.g., 'us-south', 'eu-de')
        """
        if region not in self.REGION_ENDPOINTS:
            raise ValueError(
                f"Invalid region '{region}'. Valid regions: {', '.join(self.REGION_ENDPOINTS.keys())}"
            )
        
        self.iam_auth = iam_auth
        self.instance_id = instance_id
        self.region = region
        self.base_url = self.REGION_ENDPOINTS[region]
    
    def _get_headers(self) -> Dict[str, str]:
        """
        Get HTTP headers with IAM authentication.
        
        Returns:
            Dictionary of HTTP headers
        """
        access_token = self.iam_auth.get_access_token()
        return {
            "Authorization": f"Bearer {access_token}",
            "IBMInstanceID": self.instance_id,
            "Content-Type": "application/json",
        }
    
    def list_dashboards(self) -> list:
        """
        List all dashboards in the Sysdig instance.
        
        Returns:
            List of dashboard objects
        """
        url = f"{self.base_url}/api/v3/dashboards"
        
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=30)
            response.raise_for_status()
            data = response.json()
            return data.get("dashboards", [])
        except requests.exceptions.RequestException as e:
            print(f"Error listing dashboards: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            return []
    
    def find_dashboard_by_name(self, name: str) -> Optional[Dict]:
        """
        Find a dashboard by its name.
        
        Args:
            name: Dashboard name to search for
            
        Returns:
            Dashboard object if found, None otherwise
        """
        dashboards = self.list_dashboards()
        for dashboard in dashboards:
            if dashboard.get("name") == name:
                return dashboard
        return None
    
    def create_dashboard(self, dashboard_config: Dict) -> Dict:
        """
        Create a new dashboard.
        
        Args:
            dashboard_config: Dashboard configuration dictionary
            
        Returns:
            Created dashboard object
        """
        url = f"{self.base_url}/api/v3/dashboards"
        
        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json={"dashboard": dashboard_config},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error creating dashboard: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            raise
    
    def update_dashboard(self, dashboard_id: int, dashboard_config: Dict) -> Dict:
        """
        Update an existing dashboard.
        
        Args:
            dashboard_id: ID of the dashboard to update
            dashboard_config: New dashboard configuration
            
        Returns:
            Updated dashboard object
        """
        url = f"{self.base_url}/api/v3/dashboards/{dashboard_id}"
        
        try:
            response = requests.put(
                url,
                headers=self._get_headers(),
                json={"dashboard": dashboard_config},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error updating dashboard: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            raise
    
    def import_or_update_dashboard(self, dashboard_config: Dict) -> Dict:
        """
        Import a dashboard or update it if it already exists.
        
        Args:
            dashboard_config: Dashboard configuration dictionary
            
        Returns:
            Dashboard object (created or updated)
        """
        dashboard_name = dashboard_config.get("name")
        if not dashboard_name:
            raise ValueError("Dashboard configuration must include a 'name' field")
        
        print(f"Checking if dashboard '{dashboard_name}' exists...")
        existing_dashboard = self.find_dashboard_by_name(dashboard_name)
        
        if existing_dashboard:
            dashboard_id = existing_dashboard.get("id")
            if dashboard_id is None:
                raise ValueError(f"Dashboard '{dashboard_name}' found but has no ID")
            print(f"Dashboard '{dashboard_name}' found (ID: {dashboard_id}). Updating...")
            result = self.update_dashboard(dashboard_id, dashboard_config)
            print(f"✓ Dashboard '{dashboard_name}' updated successfully!")
            return result
        else:
            print(f"Dashboard '{dashboard_name}' not found. Creating new dashboard...")
            result = self.create_dashboard(dashboard_config)
            dashboard_id = result.get("dashboard", {}).get("id")
            print(f"✓ Dashboard '{dashboard_name}' created successfully (ID: {dashboard_id})!")
            return result


def load_dashboard_config(file_path: str) -> Dict:
    """
    Load dashboard configuration from a JSON file.
    
    Args:
        file_path: Path to the JSON file
        
    Returns:
        Dashboard configuration dictionary
    """
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Dashboard file '{file_path}' not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in dashboard file: {e}")
        sys.exit(1)


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Import or update IBM Cloud Monitoring (Sysdig) dashboards using IBM Cloud IAM authentication",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Using command-line arguments
  python import_dashboard.py \\
      --iam-api-key YOUR_IAM_KEY \\
      --instance-id YOUR_INSTANCE_ID \\
      --region us-south \\
      --dashboard code-engine-overview.json
  
  # Using environment variables
  export IBM_CLOUD_IAM_API_KEY=YOUR_IAM_KEY
  export SYSDIG_INSTANCE_ID=YOUR_INSTANCE_ID
  export SYSDIG_REGION=us-south
  python import_dashboard.py --dashboard code-engine-overview.json

Supported Regions:
  us-south, us-east, eu-de, eu-gb, jp-tok, au-syd, jp-osa, ca-tor, br-sao

How to get your Instance ID:
  1. Go to IBM Cloud Console
  2. Navigate to your Monitoring instance
  3. Click on "Overview" or "Settings"
  4. Copy the Instance ID (GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        """
    )
    
    parser.add_argument(
        "--iam-api-key",
        help="IBM Cloud IAM API key (or set IBM_CLOUD_IAM_API_KEY env var)",
        default=os.environ.get("IBM_CLOUD_IAM_API_KEY")
    )
    
    parser.add_argument(
        "--instance-id",
        help="IBM Cloud Monitoring instance ID/GUID (or set SYSDIG_INSTANCE_ID env var)",
        default=os.environ.get("SYSDIG_INSTANCE_ID")
    )
    
    parser.add_argument(
        "--region",
        help="IBM Cloud region (or set SYSDIG_REGION env var)",
        default=os.environ.get("SYSDIG_REGION")
    )
    
    parser.add_argument(
        "--dashboard",
        required=True,
        help="Path to dashboard JSON file"
    )
    
    args = parser.parse_args()
    
    # Validate required arguments
    if not args.iam_api_key:
        print("Error: IAM API key is required. Provide via --iam-api-key or IBM_CLOUD_IAM_API_KEY environment variable")
        sys.exit(1)
    
    if not args.instance_id:
        print("Error: Instance ID is required. Provide via --instance-id or SYSDIG_INSTANCE_ID environment variable")
        sys.exit(1)
    
    if not args.region:
        print("Error: Region is required. Provide via --region or SYSDIG_REGION environment variable")
        sys.exit(1)
    
    # Load dashboard configuration
    print(f"Loading dashboard configuration from '{args.dashboard}'...")
    dashboard_config = load_dashboard_config(args.dashboard)
    
    # Initialize IAM authentication and dashboard manager
    try:
        iam_auth = IBMCloudIAMAuth(args.iam_api_key)
        manager = SysdigDashboardManager(iam_auth, args.instance_id, args.region)
        result = manager.import_or_update_dashboard(dashboard_config)
        
        # Print dashboard URL
        dashboard_id = result.get("dashboard", {}).get("id")
        if dashboard_id:
            dashboard_url = f"{manager.base_url}/#/dashboards/{dashboard_id}"
            print(f"\nDashboard URL: {dashboard_url}")
        
        print("\n✓ Operation completed successfully!")
        
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

# Made with Bob
