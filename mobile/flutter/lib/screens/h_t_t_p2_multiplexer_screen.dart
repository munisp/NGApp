import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HTTP2MultiplexerScreen extends StatelessWidget {
  const HTTP2MultiplexerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'HTTP/2 Multiplexer',
      apiPath: '/api/performance/http2-multiplexer/list',
      columnLabels: ["Client IP", "Streams", "Max Streams"],
    );
  }
}
