# Translation Review Framework - African Fintech Platform

## Overview

This framework provides a structured approach for native speakers to review and validate translations for Swahili, Hausa, Yoruba, and Igbo languages. The goal is to ensure translations are **culturally appropriate**, **technically accurate**, and **naturally phrased** for each target audience.

---

## Review Objectives

### 1. Cultural Appropriateness
- Ensure translations respect local customs and cultural norms
- Avoid phrases that may be offensive or inappropriate in the target culture
- Use culturally relevant examples and metaphors
- Respect religious and social sensitivities

### 2. Technical Accuracy
- Verify financial terminology is correctly translated
- Ensure technical terms (loan, interest, collateral, etc.) are accurate
- Validate currency representations and number formats
- Check date and time format conventions

### 3. Natural Phrasing
- Ensure translations sound natural to native speakers
- Avoid literal word-for-word translations
- Use idiomatic expressions where appropriate
- Maintain consistent tone and voice across the platform

### 4. Consistency
- Ensure consistent terminology across all screens
- Verify consistent use of formal vs. informal language
- Check for consistent capitalization and punctuation
- Validate consistent use of technical terms

---

## Review Process

### Phase 1: Initial Review (Week 1)
1. **Assign reviewers**: One native speaker per language
2. **Provide context**: Share app screenshots and user flows
3. **Review translations**: Go through all 200+ translation keys
4. **Document issues**: Use the feedback template below
5. **Submit feedback**: Via Google Forms or shared spreadsheet

### Phase 2: Revision (Week 2)
1. **Implement feedback**: Update translations based on reviewer comments
2. **Second review**: Reviewers verify changes
3. **Resolve conflicts**: Discuss any disagreements
4. **Finalize translations**: Lock approved translations

### Phase 3: User Testing (Week 3)
1. **Beta testing**: Release to small group of native speakers
2. **Collect feedback**: In-app feedback mechanism
3. **Monitor metrics**: Track completion rates and user satisfaction
4. **Final adjustments**: Make any necessary tweaks

---

## Translation Categories

### Category 1: Common UI Elements (Priority: HIGH)
- Buttons: Continue, Cancel, Save, Submit, Confirm, Back, Next, Done
- Status messages: Loading, Error, Success
- Navigation: Home, Profile, Settings, Help, Logout

**Review Focus**: These are used throughout the app, so accuracy is critical.

### Category 2: Financial Terminology (Priority: HIGH)
- Loan, Interest, Collateral, Repayment, Default, Credit Score
- Payment, Transaction, Transfer, Deposit, Withdrawal
- Balance, Fee, Commission, Revenue

**Review Focus**: Ensure technical accuracy and consistency with local banking terminology.

### Category 3: Feature-Specific Content (Priority: MEDIUM)
- School Fees: Installment, Academic Year, Term, Overdue
- P2P Lending: Borrower, Lender, Marketplace, Funding
- Savings Circles: Contribution, Payout, Auction, Members
- Agricultural Insurance: Coverage, Premium, Claim, Weather Data

**Review Focus**: Ensure terminology aligns with how these services are described locally.

### Category 4: Error Messages (Priority: HIGH)
- Network error, Server error, Invalid input, Unauthorized
- Insufficient balance, Transaction failed, Timeout

**Review Focus**: Errors should be clear and actionable, not alarming.

### Category 5: Marketing Content (Priority: MEDIUM)
- Onboarding messages, Feature descriptions, Value propositions
- Promotional content, Success stories

**Review Focus**: Ensure marketing copy is compelling and culturally resonant.

---

## Review Guidelines by Language

### Swahili (Kenya, Tanzania, Uganda)
**Target Audience**: Urban and rural users in East Africa, ages 18-45

**Key Considerations**:
- Use standard Swahili (not regional dialects)
- Financial terms: Use established banking terminology (e.g., "mkopo" for loan, "riba" for interest)
- Formality: Use respectful but not overly formal language (use "wewe" not "ninyi")
- Numbers: Use Arabic numerals, not Swahili number words
- Currency: KSh (Kenyan Shilling), TZS (Tanzanian Shilling), UGX (Ugandan Shilling)

**Common Pitfalls**:
- Avoid overly literal translations from English
- Don't use archaic or overly poetic language
- Ensure consistency with M-Pesa terminology (widely used in East Africa)

**Example Review**:
- ❌ "Pesa ya simu" (literal: phone money)
- ✅ "M-Pesa" or "Pesa ya simu ya mkononi" (mobile money)

---

### Hausa (Northern Nigeria, Niger)
**Target Audience**: Muslim-majority regions, ages 18-50, mix of urban and rural

**Key Considerations**:
- Use standard Hausa (Kano dialect preferred)
- Financial terms: Use established terminology (e.g., "bashi" for loan, "riba" for interest - note: "riba" has religious connotations)
- Formality: Use respectful language appropriate for elders
- Numbers: Use Arabic numerals
- Currency: ₦ (Naira), XOF (West African CFA Franc)
- Religious sensitivity: Avoid terms that conflict with Islamic finance principles

**Common Pitfalls**:
- Be careful with "riba" (interest) - some users may prefer "kudin kari" (extra money)
- Avoid overly Anglicized terms
- Ensure consistency with local banking terminology

**Example Review**:
- ❌ "Riba" (may be seen as haram/forbidden)
- ✅ "Kudin kari" or "Karin kudi" (extra money/additional payment)

---

### Yoruba (Southwestern Nigeria)
**Target Audience**: Southwestern Nigeria, ages 18-50, urban and semi-urban

**Key Considerations**:
- Use standard Yoruba with proper diacritics (ẹ, ọ, ṣ)
- Financial terms: Use established terminology (e.g., "awin" for loan, "èlé" for interest)
- Formality: Use respectful but accessible language
- Numbers: Use Arabic numerals
- Currency: ₦ (Naira)
- Tone marks: Essential for meaning (e.g., "oko" = hoe, "ọkọ" = vehicle, "ọkọ̀" = husband)

**Common Pitfalls**:
- Don't omit diacritics - they change meaning
- Avoid mixing Yoruba with English unnecessarily
- Ensure consistency with local cooperative terminology (esusu, ajo)

**Example Review**:
- ❌ "Loan" (English word)
- ✅ "Awin" or "Gbese" (Yoruba for loan/debt)

---

### Igbo (Southeastern Nigeria)
**Target Audience**: Southeastern Nigeria, ages 18-50, urban and semi-urban

**Key Considerations**:
- Use standard Igbo (Central Igbo dialect)
- Financial terms: Use established terminology (e.g., "ụgwọ" for debt/loan, "ọmụrụ nwa" for interest)
- Formality: Use respectful language
- Numbers: Use Arabic numerals
- Currency: ₦ (Naira)
- Tone marks: Important for clarity (though less critical than in Yoruba)

**Common Pitfalls**:
- Avoid overly literal translations
- Don't mix Igbo with English unnecessarily
- Ensure consistency with local trading terminology (Igbo are known for commerce)

**Example Review**:
- ❌ "Interest rate" (English)
- ✅ "Ọnụ ahịa ọmụrụ nwa" (rate of interest growth)

---

## Feedback Template

### Translation Issue Report

**Language**: [Swahili / Hausa / Yoruba / Igbo]  
**Translation Key**: [e.g., `school_fees.title`]  
**Current Translation**: [Copy current translation]  
**Issue Type**: [Cultural / Technical / Phrasing / Consistency]  
**Severity**: [Critical / High / Medium / Low]  
**Suggested Fix**: [Your proposed translation]  
**Explanation**: [Why the current translation is problematic and why your suggestion is better]

**Example**:
```
Language: Swahili
Translation Key: lending.credit_score
Current Translation: "Alama ya mkopo"
Issue Type: Technical
Severity: High
Suggested Fix: "Kiwango cha mkopo" or "Hadhi ya mkopo"
Explanation: "Alama" means "mark" or "sign", which doesn't convey the concept of a numerical score. "Kiwango" (level) or "Hadhi" (status/rank) better captures the meaning of credit score.
```

---

## Review Checklist

### For Each Translation Key:

- [ ] **Accuracy**: Does the translation convey the same meaning as the English original?
- [ ] **Naturalness**: Does it sound like something a native speaker would say?
- [ ] **Cultural fit**: Is it appropriate for the target culture?
- [ ] **Technical correctness**: Are financial/technical terms accurate?
- [ ] **Consistency**: Does it use the same terminology as other translations?
- [ ] **Length**: Does it fit in the UI (not too long)?
- [ ] **Tone**: Is the formality level appropriate?
- [ ] **Grammar**: Is it grammatically correct?
- [ ] **Spelling**: Are there any typos or spelling errors?
- [ ] **Diacritics** (Yoruba): Are tone marks correctly placed?

---

## Compensation & Timeline

### Reviewer Compensation
- **Per language**: ₦50,000 - ₦100,000 ($60-$120 USD)
- **Payment method**: Bank transfer or mobile money
- **Timeline**: 2-3 weeks (flexible based on reviewer availability)

### Deliverables
1. **Completed review spreadsheet** with all feedback
2. **Summary report** highlighting major issues and patterns
3. **Recommended changes** for each flagged translation
4. **Cultural insights** document for future reference

---

## Quality Metrics

### Success Criteria
- **95%+ approval rate** from native speaker reviewers
- **Zero critical issues** (mistranslations, offensive content)
- **<5% of translations** require major revisions
- **Consistent terminology** across all screens

### User Testing Metrics
- **Onboarding completion rate**: >85% (vs. 60% baseline)
- **User satisfaction**: >4.5/5 stars for language quality
- **Support tickets**: <5% related to translation confusion
- **Feature adoption**: 3-5x increase in non-English markets

---

## Tools & Resources

### Translation Management
- **Spreadsheet**: Google Sheets with all 200+ keys
- **Context**: Screenshots of each screen showing where text appears
- **Glossary**: Standardized terminology for financial terms
- **Style guide**: Tone, formality, and formatting guidelines

### Communication
- **Slack channel**: #translation-review for quick questions
- **Weekly calls**: 30-minute sync with each reviewer
- **Email**: For formal feedback submission

### Reference Materials
- **Local banking apps**: Check how competitors translate terms
- **Government websites**: Official terminology for financial services
- **Language resources**: Dictionaries, grammar guides, style guides

---

## Common Translation Patterns

### Pattern 1: Financial Terms
| English | Swahili | Hausa | Yoruba | Igbo |
|---------|---------|-------|--------|------|
| Loan | Mkopo | Bashi | Awin / Gbese | Ụgwọ / Mgbazinye |
| Interest | Riba | Kudin kari | Èlé | Ọmụrụ nwa |
| Payment | Malipo | Biya | Isanwo | Ịkwụ ụgwọ |
| Balance | Salio | Ragowar kuɗi | Iyoku | Ndokwa |
| Transaction | Muamala | Ciniki | Iṣowo | Azụmahịa |

### Pattern 2: Action Buttons
| English | Swahili | Hausa | Yoruba | Igbo |
|---------|---------|-------|--------|------|
| Continue | Endelea | Ci gaba | Tẹsiwaju | Gaa n'ihu |
| Cancel | Ghairi | Soke | Fagilee | Kagbuo |
| Save | Hifadhi | Ajiye | Fipamọ | Chekwaa |
| Submit | Wasilisha | Tura | Firanṣẹ | Zipu |
| Confirm | Thibitisha | Tabbatar | Jẹrisi | Kwado |

### Pattern 3: Status Messages
| English | Swahili | Hausa | Yoruba | Igbo |
|---------|---------|-------|--------|------|
| Loading | Inapakia | Ana lodawa | N ṣiṣẹ | Na-ebu |
| Success | Mafanikio | Nasara | Aṣeyọri | Ihe ịga nke ọma |
| Error | Hitilafu | Kuskure | Aṣiṣe | Njehie |
| Pending | Inasubiri | Ana jira | N duro | Na-echere |

---

## Next Steps After Review

### 1. Implement Feedback (Week 3)
- Update translation files with approved changes
- Run automated tests to ensure no broken keys
- Update documentation with new terminology

### 2. Second Review (Week 4)
- Send updated translations back to reviewers
- Verify all feedback has been addressed
- Get final sign-off from each reviewer

### 3. Beta Testing (Week 5-6)
- Release to 100 users per language
- Collect in-app feedback
- Monitor completion rates and user satisfaction
- Make final adjustments

### 4. Full Rollout (Week 7)
- Deploy to production for all users
- Monitor metrics closely for first 2 weeks
- Set up ongoing feedback mechanism
- Plan quarterly translation reviews

---

## Contact Information

**Translation Project Manager**: [Name]  
**Email**: translations@africanfintech.com  
**Slack**: #translation-review  
**Phone**: +234-XXX-XXX-XXXX

---

## Appendix: Full Translation Key List

### Common (30 keys)
- welcome, continue, cancel, save, loading, error, success, submit, confirm, back, next, done, skip, close, delete, edit, view, search, filter, sort, refresh, retry, yes, no, ok, apply, reset, clear

### Home (10 keys)
- title, subtitle, greeting, balance, transactions, services, profile, settings, help, logout

### Onboarding (8 keys)
- welcome_title, welcome_subtitle, features_title, features_subtitle, complete_title, complete_subtitle, get_started, learn_more

### Authentication (15 keys)
- login, register, email, password, forgot_password, reset_password, create_account, already_have_account, dont_have_account, sign_in, sign_up, sign_out, verify_email, verification_code, resend_code

### School Fees (20 keys)
- title, subtitle, dashboard, create_plan, my_plans, due_date, amount_due, total_amount, paid_amount, remaining_amount, installment_amount, number_of_installments, payment_frequency, student_name, school_name, academic_year, term, make_payment, payment_history, next_payment, overdue, paid, pending

### Airtime Collateral (15 keys)
- title, subtitle, dashboard, request_loan, my_loans, airtime_balance, available_credit, loan_amount, collateral_amount, interest_rate, repayment_period, total_repayment, approve_loan, repay_loan, loan_status, active, completed, defaulted

### Agricultural Insurance (15 keys)
- title, subtitle, dashboard, buy_policy, my_policies, crop_type, farm_size, coverage_amount, premium_amount, policy_period, weather_data, claim_status, file_claim, claim_amount, approved, rejected, under_review

### P2P Lending (20 keys)
- title, subtitle, dashboard, borrow, lend, marketplace, my_loans, my_investments, loan_amount, interest_rate, loan_term, monthly_payment, credit_score, loan_purpose, request_loan, fund_loan, repayment_schedule, borrower, lender, funded, repaying

### Bill Splitting (15 keys)
- title, subtitle, dashboard, create_expense, my_expenses, expense_name, total_amount, split_method, equal_split, custom_split, participants, add_participant, your_share, amount_owed, amount_to_receive, settle_up, mark_as_paid, settled, unsettled

### Savings Circles (20 keys)
- title, subtitle, dashboard, create_circle, join_circle, my_circles, circle_name, target_amount, contribution_amount, contribution_frequency, members, payout_schedule, next_payout, total_saved, my_contribution, contribute, payout_order, active_circles, completed_circles

### Payments (15 keys)
- title, subtitle, send_money, request_money, payment_history, recipient, amount, description, payment_method, card, bank_transfer, mobile_money, wallet, transaction_id, transaction_date, transaction_status, successful, failed, processing

### Wallet (12 keys)
- title, subtitle, balance, add_money, withdraw, transaction_history, recent_transactions, all_transactions, income, expenses, transfer, deposit, withdrawal

### Profile (20 keys)
- title, subtitle, personal_info, full_name, phone_number, email_address, date_of_birth, address, city, state, country, edit_profile, change_password, security, notifications, language, currency, privacy, terms, about, version

### Notifications (12 keys)
- title, subtitle, all, unread, read, mark_all_read, no_notifications, payment_received, payment_sent, loan_approved, loan_due, circle_payout, new_message, system_update

### Errors (15 keys)
- network_error, server_error, invalid_input, unauthorized, not_found, timeout, unknown_error, insufficient_balance, transaction_failed, invalid_amount, invalid_email, invalid_phone, password_mismatch, weak_password

### Success Messages (8 keys)
- payment_successful, loan_approved, profile_updated, password_changed, registration_complete, verification_successful, transaction_complete, saved_successfully

**Total: 200+ translation keys**

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Ready for Review
