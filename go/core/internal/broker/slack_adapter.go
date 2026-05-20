/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package broker

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	v1alpha2 "github.com/kagent-dev/kagent/go/api/v1alpha2"
	"github.com/kagent-dev/kagent/go/core/pkg/auth"
)

const (
	// Slack Secret keys.
	slackKeyBotToken = "bot_token"
)

// SlackAdapter implements auth.PlatformAdapter for Slack.
// Only the BotToken source type is supported — user-scoped Slack tokens are
// outside this CRD's scope and flow via header propagation instead.
type SlackAdapter struct {
	client client.Client
}

// NewSlackAdapter creates a SlackAdapter with the given controller-runtime client.
func NewSlackAdapter(c client.Client) *SlackAdapter {
	return &SlackAdapter{client: c}
}

// Platform returns the platform identifier.
func (a *SlackAdapter) Platform() string {
	return "slack"
}

// Mint reads a long-lived Slack bot token directly from the referenced Secret.
func (a *SlackAdapter) Mint(ctx context.Context, source v1alpha2.CredentialSource, credNamespace string, principal auth.Principal, scopes []string) (*auth.Token, error) {
	if source.Type != v1alpha2.CredentialSourceTypeBotToken {
		return nil, fmt.Errorf("%w: unsupported source type %s for slack adapter", ErrInvalidSource, source.Type)
	}
	if source.SecretRef == nil {
		return nil, fmt.Errorf("%w: SecretRef is required for slack adapter", ErrInvalidSource)
	}

	secret := &corev1.Secret{}
	if err := a.client.Get(ctx, types.NamespacedName{Name: source.SecretRef.Name, Namespace: credNamespace}, secret); err != nil {
		return nil, fmt.Errorf("failed to get Secret %s/%s: %w", credNamespace, source.SecretRef.Name, err)
	}

	botToken, err := getSecretKey(secret, slackKeyBotToken)
	if err != nil {
		return nil, err
	}

	return &auth.Token{
		Value:     botToken,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Platform:  "slack",
		Scopes:    scopes,
		Principal: principal.Agent.ID,
	}, nil
}

// Validate checks that the credential source has the required configuration for Slack.
func (a *SlackAdapter) Validate(source v1alpha2.CredentialSource) error {
	if source.Type != v1alpha2.CredentialSourceTypeBotToken {
		return fmt.Errorf("%w: expected source type BotToken, got %s", ErrInvalidSource, source.Type)
	}
	if source.SecretRef == nil {
		return fmt.Errorf("%w: SecretRef is required for slack adapter", ErrInvalidSource)
	}
	if source.SecretRef.Name == "" {
		return fmt.Errorf("%w: SecretRef.Name must not be empty", ErrInvalidSource)
	}
	return nil
}
