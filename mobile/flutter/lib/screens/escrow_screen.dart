import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EscrowScreen extends StatelessWidget {
  const EscrowScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Multi-Party Escrow',
      apiEndpoint: '/api/platform/escrow/list',
      columnKeys: const ['id', 'escrowType', 'parties', 'amount', 'currency', 'interestRate', 'status', 'expiresAt'],
      columnLabels: const ['ID', 'Type', 'Parties', 'Amount', 'Currency', 'Rate %', 'Status', 'Expires'],
      seedData: const [
        {'id': 'ESC-001', 'escrowType': 'property', 'parties': '3 parties — BUA / FMBN / Lagos Lands', 'amount': 'NGN 15B', 'currency': 'NGN', 'interestRate': '8.5%', 'status': 'active', 'expiresAt': '2026-12-31'},
        {'id': 'ESC-002', 'escrowType': 'm_and_a', 'parties': '4 parties — Dangote / Lafarge / SEC / Banwo&Ighodalo', 'amount': 'USD 500M', 'currency': 'USD', 'interestRate': '4.25%', 'status': 'pending_condition', 'expiresAt': '2026-06-30'},
        {'id': 'ESC-003', 'escrowType': 'trade', 'parties': '3 parties — Nigerian Breweries / Cargill / SGS', 'amount': 'NGN 2B', 'currency': 'NGN', 'interestRate': '7.0%', 'status': 'active', 'expiresAt': '2026-09-30'},
        {'id': 'ESC-004', 'escrowType': 'litigation', 'parties': '3 parties — Court Registry / Multiple / Justice Adeyemi', 'amount': 'NGN 5B', 'currency': 'NGN', 'interestRate': '6.0%', 'status': 'held', 'expiresAt': '2027-12-31'},
        {'id': 'ESC-005', 'escrowType': 'construction', 'parties': '4 parties — Julius Berger / NNPC / Engr Okafor / InfraCredit', 'amount': 'NGN 8.5B', 'currency': 'NGN', 'interestRate': '9.0%', 'status': 'milestone_pending', 'expiresAt': '2027-06-30'},
        {'id': 'ESC-006', 'escrowType': 'ip_license', 'parties': '2 parties — Interswitch / Visa', 'amount': 'USD 250M', 'currency': 'USD', 'interestRate': '3.5%', 'status': 'released', 'expiresAt': '2026-05-01'},
        {'id': 'ESC-007', 'escrowType': 'government_contract', 'parties': '3 parties — Fed Min Works / OORBDA / BPP', 'amount': 'NGN 12B', 'currency': 'NGN', 'interestRate': '7.5%', 'status': 'active', 'expiresAt': '2028-12-31'},
        {'id': 'ESC-008', 'escrowType': 'dispute_resolution', 'parties': '3 parties — Access Bank / GTBank / LCIA Panel', 'amount': 'NGN 3.5B', 'currency': 'NGN', 'interestRate': '6.5%', 'status': 'disputed', 'expiresAt': '2026-11-30'},
        {'id': 'ESC-009', 'escrowType': 'agriculture', 'parties': '3 parties — Olam / Kano Farmers / NAFDAC', 'amount': 'NGN 500M', 'currency': 'NGN', 'interestRate': '10.0%', 'status': 'active', 'expiresAt': '2026-10-31'},
        {'id': 'ESC-010', 'escrowType': 'energy', 'parties': '5 parties — NBET / Nova Power / NERC / Afri-Infra / AFC', 'amount': 'NGN 25B', 'currency': 'NGN', 'interestRate': '8.0%', 'status': 'milestone_pending', 'expiresAt': '2028-12-31'},
      ],
    );
  }
}
