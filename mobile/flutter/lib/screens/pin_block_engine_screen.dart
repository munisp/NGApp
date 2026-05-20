import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PinBlockEngineScreen extends StatelessWidget {
    const PinBlockEngineScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PIN Block Engine',
      apiPath: '/api/security/pin-blocks',
      columnLabels:   const PinBlockEngineScreen({Key? key}) : super(key: key);
            'format': 'Format',
            'panMasked': 'Pan Masked',
            'keyId': 'Key Id',
            'channel': 'Channel',
            'status': 'Status',
            'isoFormat': 'Iso Format',      },
    );
  }
}
