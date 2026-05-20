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

package handlers

import (
	"net/http"

	"github.com/kagent-dev/kagent/go/api/v1alpha2"
	"github.com/kagent-dev/kagent/go/core/pkg/auth"
	ctrllog "sigs.k8s.io/controller-runtime/pkg/log"
)

type CredentialsHandler struct {
	*Base
}

func NewCredentialsHandler(base *Base) *CredentialsHandler {
	return &CredentialsHandler{Base: base}
}

type CredentialListItem struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Platform    string `json:"platform"`
	SourceType  string `json:"sourceType"`
	SecretName  string `json:"secretName,omitempty"`
	ClusterName string `json:"clusterName,omitempty"`
	Ready       bool   `json:"ready"`
}

// HandleListCredentials handles GET /api/v1/credentials.
// Query params: platform (optional), type (optional).
func (h *CredentialsHandler) HandleListCredentials(w ErrorResponseWriter, r *http.Request) {
	log := ctrllog.FromContext(r.Context()).WithName("credentials-handler").WithValues("operation", "list")

	if err := Check(h.Authorizer, r, auth.Resource{Type: "PlatformCredential"}); err != nil {
		w.RespondWithError(err)
		return
	}

	platformFilter := r.URL.Query().Get("platform")
	typeFilter := r.URL.Query().Get("type")

	credList := &v1alpha2.PlatformCredentialList{}
	if err := h.KubeClient.List(r.Context(), credList); err != nil {
		log.Error(err, "Failed to list PlatformCredentials")
		RespondWithError(w, http.StatusInternalServerError, "Failed to list credentials")
		return
	}

	items := make([]CredentialListItem, 0, len(credList.Items))
	for _, cred := range credList.Items {
		if platformFilter != "" && cred.Spec.Platform != platformFilter {
			continue
		}
		if typeFilter != "" && string(cred.Spec.Source.Type) != typeFilter {
			continue
		}

		item := CredentialListItem{
			Name:       cred.Name,
			Namespace:  cred.Namespace,
			Platform:   cred.Spec.Platform,
			SourceType: string(cred.Spec.Source.Type),
		}
		if cred.Spec.Source.SecretRef != nil {
			item.SecretName = cred.Spec.Source.SecretRef.Name
		}
		if clusterName, ok := cred.Labels["kagent.dev/cluster-name"]; ok {
			item.ClusterName = clusterName
		}
		for _, cond := range cred.Status.Conditions {
			if cond.Type == v1alpha2.PlatformCredentialConditionTypeReady && cond.Status == "True" {
				item.Ready = true
				break
			}
		}
		items = append(items, item)
	}

	RespondWithJSON(w, http.StatusOK, items)
}
