package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/IBM/go-sdk-core/v5/core"
	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/aws/credentials/ibmiam"
	"github.com/IBM/ibm-cos-sdk-go/aws/credentials/ibmiam/token"
	"github.com/IBM/ibm-cos-sdk-go/aws/session"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

const maxObjectBytes = 26 << 20 // GitHub payloads are up to 25 MB, plus envelope

type objectGetter interface {
	Get(ctx context.Context, bucket, key string) ([]byte, error)
}

type cosGetter struct {
	client *s3.S3
}

func (c *cosGetter) Get(ctx context.Context, bucket, key string) ([]byte, error) {
	out, err := c.client.GetObjectWithContext(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	defer out.Body.Close()

	data, err := io.ReadAll(io.LimitReader(out.Body, maxObjectBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxObjectBytes {
		return nil, fmt.Errorf("object larger than %d bytes", maxObjectBytes)
	}
	return data, nil
}

// jwtExpiry returns the expiry time ("exp" claim) of an IAM access token, which is a JWT.
// The signature is not verified: the token comes straight from IAM and is only inspected here.
func jwtExpiry(accessToken string) (time.Time, error) {
	parts := strings.Split(accessToken, ".")
	if len(parts) != 3 {
		return time.Time{}, fmt.Errorf("access token is not a JWT")
	}
	claims, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, fmt.Errorf("cannot decode the claims of the access token: %w", err)
	}
	var c struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(claims, &c); err != nil {
		return time.Time{}, fmt.Errorf("cannot parse the claims of the access token: %w", err)
	}
	if c.Exp == 0 {
		return time.Time{}, fmt.Errorf("access token has no exp claim")
	}
	return time.Unix(c.Exp, 0), nil
}

// newCOSClient creates a COS client from COS_ENDPOINT, COS_REGION and TRUSTED_PROFILE_ID.
// Credentials come from the Code Engine trusted profile (compute resource token), no API key involved.
// The IBM SDK core ContainerAuthenticator exchanges the compute resource token for IAM access tokens
// and caches and refreshes them. The COS client is told the real expiry of the access token (from its
// JWT), and asks the authenticator for a new one shortly before that.
func newCOSClient() *s3.S3 {
	endpoint := mustEnv("COS_ENDPOINT")
	region := mustEnv("COS_REGION")
	profileID := mustEnv("TRUSTED_PROFILE_ID")
	iamEndpoint := getEnv("IBM_AUTH_ENDPOINT", "https://private.iam.cloud.ibm.com")
	tokenFile := getEnv("CR_TOKEN_FILE_PATH", "/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token")

	authenticator, err := core.NewContainerAuthenticatorBuilder().
		SetIAMProfileID(profileID).
		SetCRTokenFilename(tokenFile).
		SetURL(iamEndpoint).
		Build()
	if err != nil {
		log.Fatalf("cannot create authenticator: %v", err)
	}

	cfg := aws.NewConfig().
		WithEndpoint(endpoint).
		WithRegion(region).
		WithS3ForcePathStyle(true).
		WithCredentials(ibmiam.NewCustomInitFuncCredentials(aws.NewConfig(), func() (*token.Token, error) {
			accessToken, err := authenticator.GetToken()
			if err != nil {
				return nil, err
			}
			expiry, err := jwtExpiry(accessToken)
			if err != nil {
				return nil, err
			}
			return &token.Token{
				AccessToken: accessToken,
				TokenType:   "Bearer",
				ExpiresIn:   int64(time.Until(expiry).Seconds()),
				Expiration:  expiry.Unix(),
			}, nil
		}, iamEndpoint, ""))
	sess, err := session.NewSession(cfg)
	if err != nil {
		log.Fatalf("cannot create COS session: %v", err)
	}
	return s3.New(sess)
}
