package com.ibm.cloud.codeengine.sample;

import java.io.IOException;
import java.io.InputStream;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathExpressionException;
import javax.xml.xpath.XPathFactory;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import com.ibm.cloud.sdk.core.security.Authenticator;
import com.ibm.cloud.sdk.core.security.ContainerAuthenticator;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class App {

    public static void main(String[] args) throws IOException, ParserConfigurationException, SAXException, XPathExpressionException {
        // read environment variables
        String cosBucket = System.getenv("COS_BUCKET");
        if (cosBucket == null) {
            System.err.println("environment variable COS_BUCKET is not set");
            System.exit(1);
        }

        String cosRegion = System.getenv("COS_REGION");
        if (cosRegion == null) {
            System.err.println("environment variable COS_REGION is not set");
            System.exit(1);
        }

        String trustedProfileName = System.getenv("TRUSTED_PROFILE_NAME");
        if (trustedProfileName == null) {
            System.err.println("environment variable TRUSTED_PROFILE_NAME is not set");
            System.exit(1);
        }

        // create an authenticator based on a trusted profile
        Authenticator authenticator = new ContainerAuthenticator.Builder().iamProfileName(trustedProfileName).build();

        // prepare the request to list the files in the bucket
        Request.Builder requestBuilder = new Request.Builder()
            .get()
            .url("https://s3.direct." + cosRegion + ".cloud-object-storage.appdomain.cloud/" + cosBucket);

        // authenticate the request
        authenticator.authenticate(requestBuilder);

        // perform the request
        OkHttpClient client = new OkHttpClient();
        try (Response response = client.newCall(requestBuilder.build()).execute()) {
            if (response.code() != 200) {
                System.err.println("Unexpected status code: " + response.code());
                System.exit(1);
            }
    
            // read the response
            try (InputStream responseBody = response.body().byteStream()) {
                // parse the response
                DocumentBuilder documentBuilder = DocumentBuilderFactory.newInstance().newDocumentBuilder();
                Document document = documentBuilder.parse(responseBody);
    
                NodeList keys = (NodeList)XPathFactory.newInstance().newXPath().evaluate("//Contents/Key", document, XPathConstants.NODESET);
    
                System.out.println("Found " + keys.getLength() + " objects:");
                for (int i = 0; i < keys.getLength(); i ++) {
                    System.out.println("- " + keys.item(i).getTextContent());
                }
            }
        }
    }
}
