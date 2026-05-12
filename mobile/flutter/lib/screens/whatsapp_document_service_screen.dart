import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhatsappDocumentServiceScreen extends StatelessWidget {
  const WhatsappDocumentServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WhatsApp Document Service',
      apiPath: '/api/channel-banking/whatsapp-document-service/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
