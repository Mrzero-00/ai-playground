import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { AppError } from './errors.js';

interface OrderStatusResponse {
  resultType?: string;
  success?: { orderId?: string; sku?: string; status?: string };
}

export async function verifyIapOrder(orderId: string, expectedSku: string): Promise<void> {
  const certPath = process.env.IAP_MTLS_CERT_PATH;
  const keyPath = process.env.IAP_MTLS_KEY_PATH;
  if (!certPath || !keyPath) {
    throw new AppError('IAP_VERIFICATION_NOT_CONFIGURED', '결제 검증 설정이 아직 준비되지 않았어요.', 503);
  }

  const body = JSON.stringify({ orderId });
  const response = await new Promise<OrderStatusResponse>((resolve, reject) => {
    const client = request({
      hostname: 'apps-in-toss-api.toss.im',
      path: '/api-partner/v1/apps-in-toss/order/get-order-status',
      method: 'POST',
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
      passphrase: process.env.IAP_MTLS_KEY_PASSPHRASE,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8_000,
    }, (result) => {
      const chunks: Buffer[] = [];
      result.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      result.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as OrderStatusResponse);
        } catch {
          reject(new Error('Invalid IAP verification response'));
        }
      });
    });
    client.on('timeout', () => client.destroy(new Error('IAP verification timeout')));
    client.on('error', reject);
    client.end(body);
  }).catch(() => {
    throw new AppError('IAP_VERIFICATION_FAILED', '결제 확인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.', 503);
  });

  const order = response.success;
  const validStatus = order?.status === 'PAYMENT_COMPLETED' || order?.status === 'PURCHASED';
  if (response.resultType !== 'SUCCESS' || order?.orderId !== orderId || order?.sku !== expectedSku || !validStatus) {
    throw new AppError('IAP_ORDER_NOT_VERIFIED', '결제가 완료된 주문인지 확인할 수 없어요.', 409);
  }
}
