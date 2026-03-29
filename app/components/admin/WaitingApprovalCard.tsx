import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateTimeIL } from './accessUtils';

type Props = {
  name?: string;
  approvalStatus?: 'pending' | 'approved' | 'blocked';
  accessEndAt?: string | null;
};

export default function WaitingApprovalCard({
  name,
  approvalStatus = 'pending',
  accessEndAt,
}: Props) {
  const title =
    approvalStatus === 'blocked'
      ? 'הגישה למערכת חסומה כרגע'
      : approvalStatus === 'approved'
      ? 'הגישה שלך למערכת אושרה'
      : 'החשבון ממתין לאישור מנהל';

  const subtitle =
    approvalStatus === 'blocked'
      ? 'כרגע אין אפשרות להיכנס למערכת. יש לפנות למנהל המערכת.'
      : approvalStatus === 'approved'
      ? 'אפשר להמשיך להשתמש במערכת עד לתאריך הסיום שהוגדר לך.'
      : 'ברגע שמנהל המערכת יאשר אותך ויגדיר לך תקופת גישה, תוכלי להתחבר.';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <Text style={styles.subtitle}>
        {name ? `${name}, ` : ''}
        {subtitle}
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>סטטוס:</Text>
        <Text style={styles.infoValue}>
          {approvalStatus === 'approved'
            ? 'מאושר'
            : approvalStatus === 'blocked'
            ? 'חסום'
            : 'ממתין לאישור'}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>תאריך סיום גישה:</Text>
        <Text style={styles.infoValue}>{formatDateTimeIL(accessEndAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D7DFE9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 18,
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'right',
    fontWeight: '700',
  },
});