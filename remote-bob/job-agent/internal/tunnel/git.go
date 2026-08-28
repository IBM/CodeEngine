package tunnel

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.ibm.com/JORDANJ/remote-bob-common/log"
)

// setupGitAuth configures the gh CLI and git identity when a PAT is
// available. Git integration is optional: without GH_PAT/GH_REPO the agent
// runs normally with no git setup.
func setupGitAuth(cfg *Config) error {
	if cfg.GHPat == "" {
		log.Info("git_auth_skipped", map[string]interface{}{
			"reason": "no GH_PAT configured",
		})
		return nil
	}
	if err := ensureBinary("gh"); err != nil {
		return err
	}
	ghHost := "github.com"
	if cfg.GHRepo != "" {
		ghHost = repoHost(cfg.GHRepo)
	}
	if err := runCommandWithInput("gh", []string{"auth", "login", "--hostname", ghHost, "--with-token"}, cfg.GHPat+"\n", ""); err != nil {
		return err
	}
	if err := runCommand("gh", []string{"auth", "setup-git", "--hostname", ghHost}, ""); err != nil {
		return err
	}
	if err := runCommand("git", []string{"config", "--global", "user.email", "remote-bob@local"}, ""); err != nil {
		return err
	}
	if err := runCommand("git", []string{"config", "--global", "user.name", "Remote Bob"}, ""); err != nil {
		return err
	}
	log.Info("git_auth_configured", map[string]interface{}{
		"gh_host": ghHost,
	})
	return nil
}

// prepareWorkspace creates the workspace directory and, when git is
// configured, clones the repo and checks out the session branch.
func prepareWorkspace(cfg *Config) error {
	if err := os.MkdirAll(cfg.Workspace, 0o755); err != nil {
		return err
	}
	if cfg.GHRepo == "" || cfg.GHPat == "" {
		return nil
	}
	repo := normalizeRepoURL(cfg.GHRepo)
	if _, err := os.Stat(filepath.Join(cfg.Workspace, ".git")); os.IsNotExist(err) {
		if err := runCommand("gh", []string{"repo", "clone", repo, cfg.Workspace, "--", "--branch", cfg.GHBranch}, ""); err != nil {
			return err
		}
	}
	branch := sessionBranch(cfg)
	if err := checkoutBranch(cfg.Workspace, branch); err != nil {
		return err
	}
	cfg.SessionBranch = branch
	log.Info("git_workspace_ready", map[string]interface{}{
		"workspace": cfg.Workspace,
		"branch":    branch,
	})
	return nil
}

// finalizeGit commits and pushes workspace changes on graceful shutdown.
// It is a no-op when git is not configured or the workspace has no repo.
func finalizeGit(cfg *Config) error {
	if cfg.SessionBranch == "" || !fileExists(filepath.Join(cfg.Workspace, ".git")) {
		return nil
	}
	if err := runCommand("git", []string{"-C", cfg.Workspace, "add", "-A"}, ""); err != nil {
		return err
	}
	if err := exec.Command("git", "-C", cfg.Workspace, "diff", "--cached", "--quiet").Run(); err != nil {
		_ = runCommand("git", []string{"-C", cfg.Workspace, "commit", "-m", fmt.Sprintf("[%s] Session %s complete", cfg.BobMode, cfg.AgentID)}, "")
	}
	_ = runCommand("git", []string{"-C", cfg.Workspace, "push", "--set-upstream", "origin", cfg.SessionBranch}, "")
	log.Info("git_finalized", map[string]interface{}{
		"workspace": cfg.Workspace,
		"branch":    cfg.SessionBranch,
	})
	return nil
}

func checkoutBranch(workspace, branch string) error {
	if err := exec.Command("git", "-C", workspace, "ls-remote", "--exit-code", "--heads", "origin", branch).Run(); err == nil {
		return runCommand("git", []string{"-C", workspace, "checkout", "-b", branch, "origin/" + branch}, "")
	}
	return runCommand("git", []string{"-C", workspace, "checkout", "-b", branch}, "")
}

func repoHost(repo string) string {
	repo = strings.TrimPrefix(repo, "https://")
	repo = strings.TrimPrefix(repo, "git@")
	repo = strings.Split(repo, "/")[0]
	return strings.Split(repo, ":")[0]
}

func normalizeRepoURL(repo string) string {
	if strings.HasPrefix(repo, "git@") {
		parts := strings.SplitN(strings.TrimPrefix(repo, "git@"), ":", 2)
		if len(parts) == 2 {
			return "https://" + parts[0] + "/" + parts[1]
		}
	}
	return repo
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func ensureBinary(name string) error {
	_, err := exec.LookPath(name)
	if err != nil {
		return fmt.Errorf("%s not found", name)
	}
	return nil
}

func runCommand(name string, args []string, stdin string) error {
	cmd := exec.Command(name, args...)
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runCommandWithInput(name string, args []string, stdin string, dir string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdin = strings.NewReader(stdin)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = dir
	return cmd.Run()
}
