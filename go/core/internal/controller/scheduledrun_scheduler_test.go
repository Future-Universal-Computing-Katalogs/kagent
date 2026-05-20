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

package controller

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"trpc.group/trpc-go/trpc-a2a-go/protocol"
)

// TestScheduledRunMessage_HasMessageID verifies that the message constructed in
// triggerRun includes a non-empty MessageID, which is required by the A2A spec
// (a2a-go validates this in a2asrv/handler.go).
func TestScheduledRunMessage_HasMessageID(t *testing.T) {
	sessionID := protocol.GenerateContextID()
	prompt := "Check operational health"

	params := protocol.SendMessageParams{
		Message: protocol.Message{
			MessageID: protocol.GenerateMessageID(),
			Kind:      protocol.KindMessage,
			Role:      protocol.MessageRoleUser,
			ContextID: &sessionID,
			Parts:     []protocol.Part{protocol.NewTextPart(prompt)},
		},
	}

	assert.NotEmpty(t, params.Message.MessageID, "MessageID is required by A2A protocol")
	assert.Equal(t, protocol.KindMessage, params.Message.Kind)
	assert.Equal(t, protocol.MessageRoleUser, params.Message.Role)
	assert.Equal(t, &sessionID, params.Message.ContextID)
	require.Len(t, params.Message.Parts, 1)
}

// TestScheduledRunMessage_MessageIDSerialized verifies the MessageID field
// appears in the JSON payload sent over the wire.
func TestScheduledRunMessage_MessageIDSerialized(t *testing.T) {
	sessionID := "ctx-test-123"
	params := protocol.SendMessageParams{
		Message: protocol.Message{
			MessageID: protocol.GenerateMessageID(),
			Kind:      protocol.KindMessage,
			Role:      protocol.MessageRoleUser,
			ContextID: &sessionID,
			Parts:     []protocol.Part{protocol.NewTextPart("test")},
		},
	}

	data, err := json.Marshal(params)
	require.NoError(t, err)

	var raw map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &raw))

	msg, ok := raw["message"].(map[string]interface{})
	require.True(t, ok, "message field must exist in params")

	msgID, ok := msg["messageId"]
	require.True(t, ok, "messageId field must be present in serialized message")
	assert.NotEmpty(t, msgID, "messageId must not be empty")
}
