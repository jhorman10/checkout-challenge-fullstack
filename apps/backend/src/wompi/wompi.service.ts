import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface WompiCustomer {
  name: string;
  email: string;
  documentType: string;
  documentNumber: string;
}

interface WompiPayment {
  cardNumber: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

interface RegisterIntentInput {
  reference: string;
  amount: number;
  currency: string;
  customer: WompiCustomer;
  transactionId: string;
}

interface AuthorizePaymentInput {
  amount: number;
  reference: string;
  currency: string;
  customer: WompiCustomer;
  payment: WompiPayment;
}

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);
  private readonly sandboxMode: boolean;
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.sandboxMode = this.configService.get<string>('WOMPI_ENV', 'sandbox') === 'sandbox';
    this.apiKey = this.configService.get<string>('WOMPI_API_KEY');
    this.baseUrl = this.configService.get<string>('WOMPI_BASE_URL', 'https://sandbox.wompi.co/v1');
  }

  async registerPaymentAttempt(input: RegisterIntentInput): Promise<{ success: boolean; providerStatus?: string; message?: string }> {
    if (!this.apiKey || !this.sandboxMode) {
      this.logger.log(`Sandbox intent registered for reference ${input.reference}`);
      return { success: true, providerStatus: 'sandbox-created' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/transactions`, {
          amount_in_cents: Math.round(input.amount),
          currency: input.currency,
          reference: input.reference,
          customer_email: input.customer.email,
          customer_data: {
            full_name: input.customer.name,
            legal_id: input.customer.documentNumber,
            legal_id_type: input.customer.documentType,
          },
        }, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return {
        success: response.data?.status === 'APPROVED' || response.data?.status === 'PENDING',
        providerStatus: response.data?.status ?? 'pending',
        message: response.data?.message ?? 'Wompi request accepted',
      };
    } catch (error) {
      this.logger.warn(`Wompi registration failed for ${input.reference}: ${String(error)}`);
      return { success: false, providerStatus: 'rejected', message: 'Payment gateway unavailable' };
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<{ success: boolean; providerStatus?: string; message?: string }> {
    if (!this.apiKey || !this.sandboxMode) {
      return { success: true, providerStatus: 'sandbox-approved', message: 'Sandbox transaction approved.' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transactions`,
          {
            amount_in_cents: Math.round(input.amount),
            currency: input.currency,
            reference: input.reference,
            customer_email: input.customer.email,
            card: {
              number: input.payment.cardNumber,
              cvc: input.payment.cvv,
              exp_month: input.payment.expMonth,
              exp_year: input.payment.expYear,
              holder: input.payment.holderName,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const status = response.data?.status ?? 'APPROVED';
      return {
        success: status === 'APPROVED',
        providerStatus: status,
        message: status === 'APPROVED' ? 'Payment approved by gateway' : 'Payment rejected by gateway',
      };
    } catch (error) {
      this.logger.warn(`Wompi authorization failed for ${input.reference}: ${String(error)}`);
      return { success: false, providerStatus: 'rejected', message: 'Payment provider rejected the request' };
    }
  }
}
