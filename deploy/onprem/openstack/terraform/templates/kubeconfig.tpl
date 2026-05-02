apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: <BASE64_CA_CERT>
    server: https://${api_server}:6443
  name: ${cluster_name}
contexts:
- context:
    cluster: ${cluster_name}
    user: ${cluster_name}-admin
  name: ${cluster_name}
current-context: ${cluster_name}
users:
- name: ${cluster_name}-admin
  user:
    client-certificate-data: <BASE64_CLIENT_CERT>
    client-key-data: <BASE64_CLIENT_KEY>
