import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateTimeIL } from './accessUtils';
import type { UserRole, UserDoc } from "../../types/user";

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
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
        <Text style={styles.infoValue}>
          {isHydrated ? formatDateTimeIL(accessEndAt) : '...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#B8B8B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 18,
  },
  infoBox: {
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#B8B8B8',
    textAlign: 'right',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'right',
    fontWeight: '700',
  },
});