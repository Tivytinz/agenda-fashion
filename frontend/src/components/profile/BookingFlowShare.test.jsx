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
      "integra uma única ação de compartilhamento a cada serviço",
      () => {
        render(
          <BookingFlow
            availability={[]}
            businessId={7}
            businessName="Studio Aurora"
            businessSlug="studio-aurora"
            day=""
            error=""
            onContinue={vi.fn()}
            onRetrySchedule={vi.fn()}
            onSelectDay={vi.fn()}
            onSelectProfessional={vi.fn()}
            onSelectService={vi.fn()}
            onSelectTime={vi.fn()}
            professionalId=""
            professionals={[
              {
                id: 3,
                nome: "Ana"
              }
            ]}
            scheduleMessage=""
            scheduleStatus="idle"
            selectedProfessional={null}
            selectedService={null}
            serviceId=""
            services={[
              {
                id: 12,
                nome:
                  "Limpeza de pele",
                valor: 50,
                duracao_minutos: 60
              }
            ]}
            time=""
          />
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Compartilhar Limpeza de pele"
            }
          )
        ).not.toBeNull();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Copiar link de Limpeza de pele"
            }
          )
        ).toBeNull();
      }
    );
  }
);
