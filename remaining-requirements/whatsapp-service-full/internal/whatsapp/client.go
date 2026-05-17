package whatsapp
import ("context"; "fmt"; "github.com/twilio/twilio-go"; openapi "github.com/twilio/twilio-go/rest/api/v2010")
type Client struct {
client *twilio.RestClient
from string
}
func New(accountSID, authToken, from string) *Client {
return &Client{client: twilio.NewRestClientWithParams(twilio.ClientParams{Username: accountSID, Password: authToken}), from: from}
}
func (c *Client) SendMessage(ctx context.Context, to, body string) (string, error) {
params := &openapi.CreateMessageParams{}
params.SetFrom("whatsapp:" + c.from)
params.SetTo("whatsapp:" + to)
params.SetBody(body)
resp, err := c.client.Api.CreateMessage(params)
if err != nil { return "", err }
return *resp.Sid, nil
}
func (c *Client) SendTemplate(ctx context.Context, to, templateName string, vars map[string]string) error {
body := fmt.Sprintf("Template: %s", templateName)
_, err := c.SendMessage(ctx, to, body)
return err
}
