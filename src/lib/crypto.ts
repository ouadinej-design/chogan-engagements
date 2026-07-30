import CryptoJS from "crypto-js";
import { NADA_SEAL_PIN, ADMIN_PASSWORD } from "./config";

export interface EngagementData {
  prenom: string;
  nom: string;
  engagements: string;
  timestamp: number;
}

export const jetonNadaFixe = CryptoJS.SHA256(NADA_SEAL_PIN)
  .toString()
  .substring(0, 16);

export function isPinValide(pin: string): boolean {
  return /^[0-9]{4,8}$/.test(pin);
}

export function estAdmin(pin: string): boolean {
  return pin === ADMIN_PASSWORD;
}

export function sceller(data: EngagementData, keyConsultante: string): string {
  const cle = `${keyConsultante}@chogan@${jetonNadaFixe}`;
  return CryptoJS.AES.encrypt(JSON.stringify(data), cle).toString();
}

export function jetonDepuisPin(pin: string): string {
  return CryptoJS.SHA256(pin).toString().substring(0, 16);
}

export function dechiffrer(
  payload: string,
  keyConsultante: string,
  keyNada: string
): EngagementData | null {
  try {
    const jeton = jetonDepuisPin(keyNada);
    const cle = `${keyConsultante}@chogan@${jeton}`;
    const bytes = CryptoJS.AES.decrypt(payload, cle);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) return null;
    return JSON.parse(decryptedText) as EngagementData;
  } catch {
    return null;
  }
}
