import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../database/firebase';
import {
  formatDateTimeIL,
  getRemainingTimeLabel,
} from './accessUtils';

type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  approvalStatus?: 'pending' | 'approved' | 'blocked';
  accessStartAt?: string | null;
  accessEndAt?: string | null;
};

type Props = {
  clients: ClientItem[];
  onAfterUpdate?: () => Promise<void> | void;
};

export default function ClientAccessManager({ clients, onAfterUpdate }: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState('30');
  const [savingId, setSavingId] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((c) => (c.uid || c.id) === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const approveClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    const days = Number(daysInput);

    if (!Number.isFinite(days) || days <= 0) {
      showMessage('שגיאה', 'יש להזין מספר ימים תקין');
      return;
    }

    const targetUid = selectedClient.uid || selectedClient.id;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);

    try {
      setSavingId(targetUid);

      await updateDoc(doc(db, 'users', targetUid), {
        approvalStatus: 'approved',
        accessStartAt: startAt.toISOString(),
        accessEndAt: endAt.toISOString(),
        approvedAt: new Date().toISOString(),
      });

      await onAfterUpdate?.();

      showMessage(
        'הצלחה',
        `הלקוח אושר בהצלחה.\nתוקף הגישה עד ${formatDateTimeIL(endAt.toISOString())}`
      );
    } catch (error) {
      console.error('שגיאה באישור לקוח:', error);
      showMessage('שגיאה', 'לא ניתן לאשר את הלקוח');
    } finally {
      setSavingId(null);
    }
  };

  const blockClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    const targetUid = selectedClient.uid || selectedClient.id;

    try {
      setSavingId(targetUid);

      await updateDoc(doc(db, 'users', targetUid), {
        approvalStatus: 'blocked',
        accessEndAt: new Date().toISOString(),
      });

      await onAfterUpdate?.();

      showMessage('בוצע', 'הגישה של הלקוח נחסמה');
    } catch (error) {
      console.error('שגיאה בחסימת לקוח:', error);
      showMessage('שגיאה', 'לא ניתן לחסום את הלקוח');
    } finally {
      setSavingId(null);
    }
  };

  const extendClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    const days = Number(daysInput);

    if (!Number.isFinite(days) || days <= 0) {
      showMessage('שגיאה', 'יש להזין מספר ימים תקין');
      return;
    }

    const targetUid = selectedClient.uid || selectedClient.id;
    const currentEnd = selectedClient.accessEndAt
      ? new Date(selectedClient.accessEndAt).getTime()
      : Date.now();

    const base = Math.max(currentEnd, Date.now());
    const newEnd = new Date(base + days * 24 * 60 * 60 * 1000);

    try {
      setSavingId(targetUid);

      await updateDoc(doc(db, 'users', targetUid), {
        approvalStatus: 'approved',
        accessEndAt: newEnd.toISOString(),
      });

      await onAfterUpdate?.();

      showMessage(
        'הצלחה',
        `תקופת הגישה הוארכה עד ${formatDateTimeIL(newEnd.toISOString())}`
      );
    } catch (error) {
      console.error('שגיאה בהארכת גישה:', error);
      showMessage('שגיאה', 'לא ניתן להאריך את תקופת הגישה');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionTitle}>אישור לקוחות והגדרת תקופת גישה</Text>

      <View style={styles.clientsList}>
        {clients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>אין לקוחות להצגה</Text>
          </View>
        ) : (
          clients.map((client) => {
            const targetUid = client.uid || client.id;
            const isSelected = selectedClientId === targetUid;

            return (
              <Pressable
                key={targetUid}
                onPress={() => setSelectedClientId(targetUid)}
                style={({ pressed }) => [
                  styles.clientItem,
                  isSelected && styles.clientItemSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.clientName}>{client.name || 'ללא שם'}</Text>
                <Text style={styles.clientEmail}>{client.email || 'ללא אימייל'}</Text>
                <Text style={styles.clientMeta}>
                  סטטוס:{' '}
                  {client.approvalStatus === 'approved'
                    ? 'מאושר'
                    : client.approvalStatus === 'blocked'
                    ? 'חסום'
                    : 'ממתין לאישור'}
                </Text>
                <Text style={styles.clientMeta}>
                  תאריך סיום: {formatDateTimeIL(client.accessEndAt)}
                </Text>
                <Text style={styles.clientMeta}>
                  זמן שנותר: {getRemainingTimeLabel(client.accessEndAt)}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.controlBox}>
        <Text style={styles.label}>מספר ימים לגישה</Text>
        <TextInput
          value={daysInput}
          onChangeText={setDaysInput}
          keyboardType="number-pad"
          placeholder="למשל 30"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          textAlign="right"
        />

        <View style={styles.buttonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              savingId && styles.disabled,
            ]}
            onPress={approveClient}
            disabled={!!savingId}
          >
            {savingId ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>אשר לקוח</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
              savingId && styles.disabled,
            ]}
            onPress={extendClient}
            disabled={!!savingId}
          >
            <Text style={styles.secondaryButtonText}>הארך גישה</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.dangerButton,
              pressed && styles.pressed,
              savingId && styles.disabled,
            ]}
            onPress={blockClient}
            disabled={!!savingId}
          >
            <Text style={styles.dangerButtonText}>חסום גישה</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  clientsList: {
    gap: 10,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  clientItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  clientItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  clientEmail: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
  },
  clientMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#334155',
    textAlign: 'right',
  },
  controlBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  buttonsRow: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 15,
  },
  dangerButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});