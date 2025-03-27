package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

var conf oauth2.Config
var oidcConfig OIDCConfig

const STATE = "state"
const SESSION_TOKEN = "session_token"

// Home struct, used for home.html template
type Home struct {
	Title                         string
	User                          User
	ClientId                      string
	ProviderAuthorizationEndpoint string
	ProviderTokenEndpoint         string
	ProviderUserInfoEndpoint      string
}

// User struct, holds all the user info shown in home.html
type User struct {
	Token   string
	Profile string
}

// OIDC configuration struct
type OIDCConfig struct {
	ClientId                      string
	ClientSecret                  string
	ProviderAuthorizationEndpoint string
	ProviderTokenEndpoint         string
	ProviderUserInfoEndpoint      string
	RedirectUrl                   string
}

// Loads the OIDC configuration from environment variables
func loadOIDCConfig() (oidcConfiguration OIDCConfig, err error) {
	oidcConfiguration.ClientId = os.Getenv("OIDC_CLIENT_ID")
	if oidcConfiguration.ClientId == "" {
		err = fmt.Errorf("missing %s environment variable", "OIDC_CLIENT_ID")
		return
	}

	oidcConfiguration.ClientSecret = os.Getenv("OIDC_CLIENT_SECRET")
	if oidcConfiguration.ClientSecret == "" {
		err = fmt.Errorf("missing %s environment variable", "OIDC_CLIENT_SECRET")
		return
	}
	oidcConfiguration.ProviderAuthorizationEndpoint = os.Getenv("OIDC_PROVIDER_AUTHORIZATION_ENDPOINT")
	if oidcConfiguration.ProviderAuthorizationEndpoint == "" {
		err = fmt.Errorf("missing %s environment variable", "OIDC_PROVIDER_AUTHORIZATION_ENDPOINT")
		return
	}
	oidcConfiguration.ProviderTokenEndpoint = os.Getenv("OIDC_PROVIDER_TOKEN_ENDPOINT")
	if oidcConfiguration.ProviderTokenEndpoint == "" {
		err = fmt.Errorf("missing %s environment variable", "OIDC_PROVIDER_TOKEN_ENDPOINT")
		return
	}
	oidcConfiguration.ProviderUserInfoEndpoint = os.Getenv("OIDC_PROVIDER_USERINFO_ENDPOINT")
	if oidcConfiguration.ProviderUserInfoEndpoint == "" {
		err = fmt.Errorf("missing %s environment variable", "OIDC_PROVIDER_USERINFO_ENDPOINT")
		return
	}
	oidcConfiguration.RedirectUrl = os.Getenv("OIDC_REDIRECT_URL")
	if oidcConfiguration.RedirectUrl == "" {
		err = fmt.Errorf("missing %s environment variable", "OIDC_REDIRECT_URL")
		return
	}
	return oidcConfiguration, nil
}

// Requests an OAuthToken using a "code" type
func GetOauthToken(r *http.Request) (*oauth2.Token, error) {

	log.Println("Getting auth token.")

	ctx := context.Background()

	if ctx == nil {
		return nil, errors.New("could not get context")
	}

	if r.URL.Query().Get(STATE) != STATE {
		return nil, errors.New("state value did not match")
	}

	// Exchange code for OAuth token
	oauth2Token, oauth2TokenError := conf.Exchange(ctx, r.URL.Query().Get("code"))
	if oauth2TokenError != nil {
		return nil, errors.New("Failed to exchange token:" + oauth2TokenError.Error())
	}

	return oauth2Token, nil
}

// Requests a user profile, using a bearer token
func GetUserProfile(r *http.Request, token oauth2.Token) (interface{}, error) {

	log.Println("Getting user profile ...")

	ctx := context.Background()

	if ctx == nil {
		return nil, errors.New("could not get context")
	}

	// Getting now the userInfo
	client := conf.Client(ctx, &token)

	// Get request using /userinfo url
	userinfoResponse, userinfoError := client.Get(oidcConfig.ProviderUserInfoEndpoint)
	if userinfoError != nil {
		return nil, errors.New("Failed to obtain userinfo:" + userinfoError.Error())
	}

	defer userinfoResponse.Body.Close()

	log.Println("Getting user profile: " + userinfoResponse.Status)

	if userinfoResponse.StatusCode != http.StatusOK {
		return nil, errors.New("HTTP status is not 200. Was " + userinfoResponse.Status + "; response: " + toJSONString(userinfoResponse.Body))
	}

	// Decoding profile info and putting it in a map, to make it more readable
	var profile map[string]interface{}
	if userinfoError = json.NewDecoder(userinfoResponse.Body).Decode(&profile); userinfoError != nil {
		return nil, userinfoError
	}

	return profile, nil

}

// Home handler for /home
func home(w http.ResponseWriter, r *http.Request) {

	log.Printf("Executing /home for '%s'", r.RequestURI)

	// Parssing home.html template
	tmpl, _ := template.ParseFiles("./static/home.html")
	data := &Home{}

	// Adding title to page
	data.Title = "OIDC sample - IBM Cloud Code Engine"

	// Getting cookie named SESSION_TOKEN
	cookie, err := r.Cookie(SESSION_TOKEN)

	if err != nil {

		// If no cookie found, that's ok, that means no user is logged in
		log.Println("No session cookie found:" + err.Error())

		// Redirecting to /, in order to show the logged in user values
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
	} else {

		log.Println("Session cookie found.")

		// A cookie was found, this means a user is logged in
		// Let's get the auth token value

		authToken := oauth2.Token{
			AccessToken: cookie.Value,
		}

		// Getting the user profile for the given auth token
		profile, profileError := GetUserProfile(r, authToken)

		if profileError != nil {
			log.Print("Error getting profile. Error: " + profileError.Error())

			// Redirecting to /auth/failed, in order to avoid an endless redirect loop
			http.Redirect(w, r, "/auth/failed", http.StatusSeeOther)
			return
		}

		// Exposing OIDC configuration values
		data.ClientId = oidcConfig.ClientId
		data.ProviderAuthorizationEndpoint = oidcConfig.ProviderAuthorizationEndpoint
		data.ProviderTokenEndpoint = oidcConfig.ProviderTokenEndpoint
		data.ProviderUserInfoEndpoint = oidcConfig.ProviderUserInfoEndpoint

		// Setting values in page template, this is what we are going to show for the logged in user
		data.User.Token = fmt.Sprintln(authToken.AccessToken)
		data.User.Profile = fmt.Sprintln(profile)

		log.Println("User already logged in:" + fmt.Sprintln(profile))

	}

	tmpl.ExecuteTemplate(w, "home", data)

}

// Home handler for /auth/failed
func authFailed(w http.ResponseWriter, r *http.Request) {

	log.Println("Executing /auth/failed")

	// Parssing auth-failed.html template
	tmpl, _ := template.ParseFiles("./static/auth-failed.html")
	data := &Home{}

	// Adding title to page
	data.Title = "Authentication Failed"

	// Exposing OIDC configuration values
	data.ClientId = oidcConfig.ClientId
	data.ProviderAuthorizationEndpoint = oidcConfig.ProviderAuthorizationEndpoint
	data.ProviderTokenEndpoint = oidcConfig.ProviderTokenEndpoint
	data.ProviderUserInfoEndpoint = oidcConfig.ProviderUserInfoEndpoint

	w.WriteHeader(http.StatusUnauthorized)
	tmpl.ExecuteTemplate(w, "authFailed", data)
}

// Login handler for /auth/login
func authLogin(w http.ResponseWriter, r *http.Request) {

	log.Println("Executing /auth/login")

	// Code request to Auth URL
	http.Redirect(w, r, conf.AuthCodeURL(STATE), http.StatusFound)
}

// Handler for /auth/callback
func authCallback(w http.ResponseWriter, r *http.Request) {

	log.Println("Executing /auth/callback")

	// Getting auth token from request
	authToken, error := GetOauthToken(r)

	if error != nil {

		log.Println("Error getting auth token. Error: " + error.Error())

		// Redirecting to /auth/failed, in order to avoid an endless redirect loop
		http.Redirect(w, r, "/auth/failed", http.StatusSeeOther)
		return
	}

	log.Println("Setting session cookie.")

	// Setting cookie with the value of this auth token

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    authToken.AccessToken,
		Path:     "/",
		Expires:  time.Now().Add(1000 * time.Second),
		HttpOnly: true,
		Secure:   true,
	})

	// Redirecting to /, in order to show the logged in user values
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// Logout handler for /auth/logout
func authLogout(w http.ResponseWriter, r *http.Request) {

	log.Println("Executing /auth/logout")

	// Parssing auth-none.html template
	tmpl, _ := template.ParseFiles("./static/auth-logout.html")
	data := &Home{}

	// Adding title to page
	data.Title = "Logged out"

	// Getting session cookie
	cookie, err := r.Cookie(SESSION_TOKEN)

	if err != nil {

		log.Println("No session cookie found:" + err.Error())

	} else {

		log.Println("Session cookie found, invalidating it.")

		// If cookie was found, let's invalidate it
		cookie.Value = ""
		cookie.Expires = time.Unix(0, 0)
		cookie.MaxAge = -1
		cookie.HttpOnly = true
	}

	// Setting the invalidated cookie
	http.SetCookie(w, cookie)
	w.WriteHeader(http.StatusFound)
	tmpl.ExecuteTemplate(w, "authLogout", data)
}

func main() {
	ctx := context.Background()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	log.Println("Starting app ...")

	// Load OIDC relevant config parameters
	var err error
	oidcConfig, err = loadOIDCConfig()
	if err != nil {
		log.Println("Aborting! Could not load OIDC config. Error: " + err.Error())
		os.Exit(1)

	}

	log.Println("Redirect URL: '" + oidcConfig.RedirectUrl + "'")

	// Building global conf object, using OAuth2/OIDC configuration
	conf = oauth2.Config{
		ClientID:     oidcConfig.ClientId,
		ClientSecret: oidcConfig.ClientSecret,
		RedirectURL:  oidcConfig.RedirectUrl,
		Scopes:       []string{"openid", "profile"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  oidcConfig.ProviderAuthorizationEndpoint,
			TokenURL: oidcConfig.ProviderTokenEndpoint,
		},
	}

	// Serving static files
	fs := http.FileServer(http.Dir("static"))

	// Creating handlers: /static /home /login /auth/callback /logout
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/auth/login", authLogin)
	http.HandleFunc("/auth/callback", authCallback)
	http.HandleFunc("/auth/logout", authLogout)
	http.HandleFunc("/auth/failed", authFailed)
	http.HandleFunc("/", home)

	// Using port 8080
	port := ":8080"
	srv := &http.Server{Addr: port}

	// Launch the HTTP server
	go func() {

		log.Printf("An instance of application '%s' has been started on port %s :)", os.Getenv("CE_APP"), port)

		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Add a SIGTERM listener to properly shutdown the app
	<-signals
	log.Println("Shutting down server")
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Failed to shutdown server: %v", err)
	}
	log.Println("Shutdown done")

}

// Helper function that converts any object into a JSON string representation
func toJSONString(obj interface{}) string {
	if obj == nil {
		return ""
	}

	bytes, err := json.Marshal(&obj)
	if err != nil {
		return "marshal error: " + err.Error()
	}

	return string(bytes)
}
