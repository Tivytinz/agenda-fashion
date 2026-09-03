// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { BookingFlow } from "./BookingFlow";

vi.mock(
  "../../analytics/track",
  () => ({
    track: vi.fn()
  })
);

afterEach(cleanup);

describe(
  "compartilhamento público dos serviços",
  () => {
    it(
      "mantém o compartilhamento fora da escolha e mostra depois da seleção",
      () => {
        const service = {
          id: 12,
          nome: "Limpeza de pele",
          valor: 50,
          duracao_minutos: 60
        };
        const professional = {
          id: 3,
          nome: "Ana"
        };
        const commonProps = {
          availability: [],
          businessId: 7,
          businessName: "Studio Aurora",
          businessSlug: "studio-aurora",
          day: "",
          error: "",
          onContinue: vi.fn(),
          onRetrySchedule: vi.fn(),
          onSelectDay: vi.fn(),
          onSelectProfessional: vi.fn(),
          onSelectService: vi.fn(),
          onSelectTime: vi.fn(),
          professionals: [professional],
          scheduleMessage: "",
          scheduleStatus: "idle",
          services: [service],
          time: ""
        };

        const { rerender } = render(
          <BookingFlow
            {...commonProps}
            professionalId=""
            selectedProfessional={null}
            selectedService={null}
            serviceId=""
          />
        );

        expect(screen.queryByRole("button", {
          name: "Compartilhar Limpeza de pele"
        })).toBeNull();

        rerender(
          <BookingFlow
            {...commonProps}
            professionalId="3"
            selectedProfessional={professional}
            selectedService={service}
            serviceId="12"
          />
        );

        expect(screen.getByRole("button", {
          name: "Compartilhar Limpeza de pele"
        })).not.toBeNull();

        expect(screen.queryByRole("button", {
          name: "Copiar link de Limpeza de pele"
        })).toBeNull();
      }
    );
  }
);
