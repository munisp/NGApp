import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'https://platform.54bank.app';
  String? _authToken;

  void setAuthToken(String token) => _authToken = token;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_authToken != null) 'Authorization': 'Bearer $_authToken',
  };

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (response.statusCode != 200) throw ApiException(response.statusCode, response.body);
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body));
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw ApiException(response.statusCode, response.body);
    }
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final response = await http.put(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body));
    if (response.statusCode != 200) throw ApiException(response.statusCode, response.body);
    return jsonDecode(response.body);
  }

  Future<void> delete(String path) async {
    final response = await http.delete(Uri.parse('$baseUrl$path'), headers: _headers);
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw ApiException(response.statusCode, response.body);
    }
  }

  // Domain-specific API methods
  Future<List<dynamic>> getCustomers() async => (await get('/api/customers'))['items'] ?? [];
  Future<Map<String, dynamic>> createCustomer(Map<String, dynamic> data) async => post('/api/customers', data);
  Future<List<dynamic>> getTransfers(String customerId) async => (await get('/api/customers/$customerId/transfers'))['items'] ?? [];
  Future<Map<String, dynamic>> createTransfer(Map<String, dynamic> data) async => post('/api/transfers', data);
  Future<List<dynamic>> getCards(String customerId) async => (await get('/api/customers/$customerId/cards'))['items'] ?? [];
  Future<Map<String, dynamic>> getOverview() async => get('/api/platform/overview');
  Future<List<dynamic>> getMortgages() async => (await get('/api/platform/mortgage/applications'))['items'] ?? [];
  Future<List<dynamic>> getLoans() async => (await get('/api/platform/education-loans/loans'))['items'] ?? [];
  Future<List<dynamic>> getDisputes() async => (await get('/api/platform/disputes/cases'))['items'] ?? [];
  Future<List<dynamic>> getEsusuGroups() async => (await get('/api/platform/esusu/groups'))['items'] ?? [];
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}
