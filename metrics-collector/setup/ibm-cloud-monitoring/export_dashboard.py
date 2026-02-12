#!/usr/bin/env python3
"""
IBM Cloud Monitoring Dashboard Export Script

This script exports Sysdig dashboards from IBM Cloud Monitoring using IBM Cloud IAM authentication.
It uses an IBM Cloud IAM API key to obtain an access token, then retrieves the dashboard via the Sysdig API.

Usage:
    python export_dashboard.py --iam-api-key <IAM_API_KEY> --instance-id <INSTANCE_ID> --region <REGION> --name <DASHBOARD_NAME>

Environment Variables:
    IBM_CLOUD_IAM_API_KEY: IBM Cloud IAM API key (alternative to --iam-api-key)
    SYSDIG_INSTANCE_ID: IBM Cloud Monitoring instance ID (alternative to --instance-id)
    SYSDIG_REGION: IBM Cloud Monitoring region (alternative to --region)

Example:
    python export_dashboard.py \\
        --iam-api-key YOUR_IAM_API_KEY \\
        --instance-id YOUR_INSTANCE_ID \\
        --region us-south \\
        --name "IBM Code Engine - Container Resource Overview"
"""

import argparse
import json
import os
import sys
from datetime import datetime
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
    """Manages Sysdig dashboard operations via REST API with IBM Cloud IAM authentication."""
    
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
    
    def get_dashboard(self, dashboard_id: int) -> Dict:
        """
        Get a dashboard by its ID.
        
        Args:
            dashboard_id: ID of the dashboard to retrieve
            
        Returns:
            Dashboard object
        """
        url = f"{self.base_url}/api/v3/dashboards/{dashboard_id}"
        
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error retrieving dashboard: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            raise
    
    def export_dashboard_by_name(self, name: str, output_dir: str = ".") -> str:
        """
        Export a dashboard by its name to a JSON file.
        
        Args:
            name: Dashboard name to export
            output_dir: Directory to save the exported file (default: current directory)
            
        Returns:
            Path to the exported file
        """
        print(f"Searching for dashboard '{name}'...")
        dashboard_summary = self.find_dashboard_by_name(name)
        
        if not dashboard_summary:
            raise ValueError(f"Dashboard '{name}' not found")
        
        dashboard_id = dashboard_summary.get("id")
        if dashboard_id is None:
            raise ValueError(f"Dashboard '{name}' found but has no ID")
        
        print(f"✓ Dashboard found (ID: {dashboard_id})")
        print(f"Retrieving full dashboard configuration...")
        
        # Get the full dashboard configuration
        dashboard_data = self.get_dashboard(dashboard_id)
        
        # Extract just the dashboard object (without wrapper)
        dashboard_config = dashboard_data.get("dashboard", {})
        
        # Generate filename with dashboard name and timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        # Sanitize dashboard name for filename
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in name)
        safe_name = safe_name.replace(' ', '_').lower()
        filename = f"{safe_name}_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        # Save to file
        print(f"Saving dashboard to '{filepath}'...")
        with open(filepath, 'w') as f:
            json.dump(dashboard_config, f, indent=2)
        
        print(f"✓ Dashboard exported successfully!")
        return filepath


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Export IBM Cloud Monitoring (Sysdig) dashboards using IBM Cloud IAM authentication",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Using command-line arguments
  python export_dashboard.py \\
      --iam-api-key YOUR_IAM_KEY \\
      --instance-id YOUR_INSTANCE_ID \\
      --region us-south \\
      --name "IBM Code Engine - Container Resource Overview"
  
  # Using environment variables
  export IBM_CLOUD_IAM_API_KEY=YOUR_IAM_KEY
  export SYSDIG_INSTANCE_ID=YOUR_INSTANCE_ID
  export SYSDIG_REGION=us-south
  python export_dashboard.py --name "My Dashboard"
  
  # Export to specific directory
  python export_dashboard.py \\
      --name "My Dashboard" \\
      --output-dir ./exports

Supported Regions:
  us-south, us-east, eu-de, eu-es, eu-gb, jp-tok, au-syd, jp-osa, ca-tor, br-sao

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
        "--name",
        required=True,
        help="Name of the dashboard to export"
    )
    
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory to save the exported dashboard (default: current directory)"
    )
    
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available dashboards and exit"
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
    
    # Initialize IAM authentication and dashboard manager
    try:
        iam_auth = IBMCloudIAMAuth(args.iam_api_key)
        manager = SysdigDashboardManager(iam_auth, args.instance_id, args.region)
        
        # List dashboards if requested
        if args.list:
            print("Listing all dashboards...")
            dashboards = manager.list_dashboards()
            if not dashboards:
                print("No dashboards found")
            else:
                print(f"\nFound {len(dashboards)} dashboard(s):\n")
                for i, dashboard in enumerate(dashboards, 1):
                    name = dashboard.get("name", "Unnamed")
                    dashboard_id = dashboard.get("id", "N/A")
                    print(f"{i}. {name} (ID: {dashboard_id})")
            sys.exit(0)
        
        # Create output directory if it doesn't exist
        if args.output_dir != "." and not os.path.exists(args.output_dir):
            os.makedirs(args.output_dir)
            print(f"Created output directory: {args.output_dir}")
        
        # Export the dashboard
        filepath = manager.export_dashboard_by_name(args.name, args.output_dir)
        
        print(f"\n✓ Export completed successfully!")
        print(f"  File: {filepath}")
        
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

# Made with Bob