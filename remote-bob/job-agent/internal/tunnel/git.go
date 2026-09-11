package tunnel

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// prepareWorkspace creates the workspace directory.
func prepareWorkspace(cfg *Config) error {
	return os.MkdirAll(cfg.Workspace, 0o755)
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
