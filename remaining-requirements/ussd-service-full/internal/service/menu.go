package service

type MenuNode struct {
	ID       string
	Text     string
	Options  []MenuOption
	IsEnd    bool
	Action   string
}

type MenuOption struct {
	Key      string
	Label    string
	NextNode string
}

func BuildMenuTree() map[string]*MenuNode {
	return map[string]*MenuNode{
		"main": {ID: "main", Text: "Welcome to NGInsure\n1. Check Policy\n2. File Claim\n3. Pay Premium\n4. Account Info\n0. Exit", Options: []MenuOption{
			{Key: "1", Label: "Check Policy", NextNode: "policy_menu"},
			{Key: "2", Label: "File Claim", NextNode: "claim_menu"},
			{Key: "3", Label: "Pay Premium", NextNode: "payment_menu"},
			{Key: "4", Label: "Account Info", NextNode: "account_info"},
			{Key: "0", Label: "Exit", NextNode: "exit"},
		}},
		"policy_menu": {ID: "policy_menu", Text: "Policy Services\n1. View Active Policies\n2. Policy Details\n3. Renewal Status\n0. Back", Options: []MenuOption{
			{Key: "1", Label: "View Active", NextNode: "view_policies", },
			{Key: "2", Label: "Details", NextNode: "policy_details"},
			{Key: "3", Label: "Renewal", NextNode: "renewal_status"},
			{Key: "0", Label: "Back", NextNode: "main"},
		}},
		"claim_menu": {ID: "claim_menu", Text: "Claims\n1. File New Claim\n2. Check Claim Status\n3. Upload Document\n0. Back", Options: []MenuOption{
			{Key: "1", Label: "File Claim", NextNode: "file_claim"},
			{Key: "2", Label: "Status", NextNode: "claim_status"},
			{Key: "3", Label: "Upload Doc", NextNode: "upload_doc"},
			{Key: "0", Label: "Back", NextNode: "main"},
		}},
		"payment_menu": {ID: "payment_menu", Text: "Payments\n1. Pay via Mobile Money\n2. Pay via Bank Transfer\n3. Payment History\n0. Back", Options: []MenuOption{
			{Key: "1", Label: "Mobile Money", NextNode: "pay_mobile"},
			{Key: "2", Label: "Bank Transfer", NextNode: "pay_bank"},
			{Key: "3", Label: "History", NextNode: "payment_history"},
			{Key: "0", Label: "Back", NextNode: "main"},
		}},
		"view_policies": {ID: "view_policies", Text: "Your active policies will be listed here.", IsEnd: true, Action: "list_policies"},
		"policy_details": {ID: "policy_details", Text: "Enter policy number:", Action: "get_policy"},
		"renewal_status": {ID: "renewal_status", Text: "Checking renewal status...", IsEnd: true, Action: "check_renewal"},
		"file_claim": {ID: "file_claim", Text: "Enter policy number for claim:", Action: "start_claim"},
		"claim_status": {ID: "claim_status", Text: "Enter claim reference:", Action: "check_claim"},
		"upload_doc": {ID: "upload_doc", Text: "Document upload via USSD not supported. Use WhatsApp or web portal.", IsEnd: true},
		"pay_mobile": {ID: "pay_mobile", Text: "Enter policy number:", Action: "mobile_payment"},
		"pay_bank": {ID: "pay_bank", Text: "Bank: First Bank\nAccount: 0012345678\nRef: Your phone number", IsEnd: true},
		"payment_history": {ID: "payment_history", Text: "Recent payments will be listed here.", IsEnd: true, Action: "list_payments"},
		"account_info": {ID: "account_info", Text: "Loading account information...", IsEnd: true, Action: "get_account"},
		"exit": {ID: "exit", Text: "Thank you for using NGInsure. Goodbye!", IsEnd: true},
	}
}

func NavigateMenu(currentNode string, input string, tree map[string]*MenuNode) (*MenuNode, string) {
	node, ok := tree[currentNode]
	if !ok { return tree["main"], "main" }
	for _, opt := range node.Options {
		if opt.Key == input { return tree[opt.NextNode], opt.NextNode }
	}
	return node, currentNode
}
