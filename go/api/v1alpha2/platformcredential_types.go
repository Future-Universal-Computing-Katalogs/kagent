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

package v1alpha2

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// CredentialSourceType represents the type of credential source.
// All source types here represent tech-identity (service principal) credentials.
// User-scoped credentials are NOT managed by this CRD — they flow as request
// headers via A2A propagation.
// +kubebuilder:validation:Enum=GitHubApp;OAuth2;BotToken;ServiceAccount;Kubeconfig
type CredentialSourceType string

const (
	CredentialSourceTypeGitHubApp      CredentialSourceType = "GitHubApp"
	CredentialSourceTypeOAuth2         CredentialSourceType = "OAuth2"
	CredentialSourceTypeBotToken       CredentialSourceType = "BotToken"
	CredentialSourceTypeServiceAccount CredentialSourceType = "ServiceAccount"
	CredentialSourceTypeKubeconfig     CredentialSourceType = "Kubeconfig"
)

const (
	PlatformCredentialConditionTypeReady = "Ready"
)

// PlatformCredentialSpec defines the desired state of PlatformCredential.
//
// PlatformCredential manages tech-identity (service principal) credentials
// used by agents to access external platforms. It does NOT manage user-scoped
// credentials — those flow as request headers via A2A propagation.
type PlatformCredentialSpec struct {
	// Platform identifies the external platform this credential provides access to.
	// +kubebuilder:validation:MinLength=1
	Platform string `json:"platform"`

	// Source defines how to obtain the raw credential material.
	Source CredentialSource `json:"source"`

	// AccessPolicy defines which agents/skills may acquire tokens and with what scopes.
	// +optional
	AccessPolicy []AccessPolicyRule `json:"accessPolicy,omitempty"`
}

// CredentialSource defines the origin of credential material.
type CredentialSource struct {
	// Type specifies the credential mechanism.
	// +kubebuilder:validation:Enum=GitHubApp;OAuth2;BotToken;ServiceAccount;Kubeconfig
	Type CredentialSourceType `json:"type"`

	// SecretRef references a Kubernetes Secret containing the credential material.
	// +optional
	SecretRef *SecretRef `json:"secretRef,omitempty"`

	// TokenEndpoint is the URL used to exchange credentials for tokens (e.g., OAuth2 token URL).
	// +optional
	TokenEndpoint string `json:"tokenEndpoint,omitempty"`
}

// SecretRef is a reference to a Kubernetes Secret in the same namespace.
type SecretRef struct {
	// Name is the name of the Secret.
	// +kubebuilder:validation:MinLength=1
	Name string `json:"name"`
}

// AccessPolicyRule defines which agent/skill principals can acquire tokens with specific scopes.
// Only tech-identity principals are supported here. User-scoped authorization is
// handled out-of-band via per-request token propagation, not via this CRD.
type AccessPolicyRule struct {
	// Principals lists the agent/skill identities allowed to acquire tokens.
	// Format: "agent:<name>", "skill:<name>", or wildcards like "agent:*".
	// User principals (e.g. "user:<name>") are not supported.
	// +kubebuilder:validation:MinItems=1
	Principals []string `json:"principals"`

	// Scopes lists the platform-specific scopes the principal may request.
	// +kubebuilder:validation:MinItems=1
	Scopes []string `json:"scopes"`
}

// PlatformCredentialStatus defines the observed state of PlatformCredential.
type PlatformCredentialStatus struct {
	// Conditions represent the latest available observations of the resource's state.
	// +optional
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// LastSync records the last time the credential source was successfully validated.
	// +optional
	LastSync *metav1.Time `json:"lastSync,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:resource:shortName=pcred,categories=kagent
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Platform",type="string",JSONPath=".spec.platform"
// +kubebuilder:printcolumn:name="Type",type="string",JSONPath=".spec.source.type"
// +kubebuilder:printcolumn:name="Ready",type="string",JSONPath=".status.conditions[?(@.type=='Ready')].status"

// PlatformCredential defines access to an external platform (GitHub, Jira, Slack, K8s).
type PlatformCredential struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   PlatformCredentialSpec   `json:"spec,omitempty"`
	Status PlatformCredentialStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// PlatformCredentialList contains a list of PlatformCredential.
type PlatformCredentialList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []PlatformCredential `json:"items"`
}

func init() {
	SchemeBuilder.Register(func(s *runtime.Scheme) error {
		s.AddKnownTypes(GroupVersion, &PlatformCredential{}, &PlatformCredentialList{})
		return nil
	})
}
