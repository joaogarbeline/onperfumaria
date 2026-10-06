import { CreditCard, Lock, Mail, ShieldCheck, Truck } from 'lucide-react'
import { InstagramIcon, WhatsAppIcon } from './icons/SocialIcons'

const trustSeals = [
  { icon: ShieldCheck, label: 'Produto 100% original' },
  { icon: Lock, label: 'Pagamento criptografado' },
  { icon: Truck, label: 'Entrega rastreada' },
  { icon: CreditCard, label: 'Checkout protegido' },
]

export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-[#5b247f]/40 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] text-[#eadcf0]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#5b247f]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#d89a28]/15 blur-3xl" />

      <div className="relative grid gap-10 border-b border-white/10 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_0.8fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.38em] text-white">ON PERFUMARIA</p>
          <p className="max-w-md text-sm leading-7 text-[#d9c2e8]">
            Na On Perfumaria fazemos a curadoria com a crença de que no ramo da perfumaria, descobrir emoções,
            memórias e identidade em cada fragrância. Afinal a vida é feita com momentos, conquista e tudo
            entrelaçado na fragrâncias que ficam na memoria.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#d89a28]">Localizacao</p>
          <p className="text-sm leading-7 text-[#fafaf8]">
            Rua Doutor Fauze Saueia, JD Los Angeles, Campo Grande-MS.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#d89a28]">
            Minhas redes sociais
          </p>
          <div className="grid gap-3 text-sm text-[#fafaf8]">
            <a
              href="https://wa.me/5567991194532"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 transition hover:text-white"
            >
              <WhatsAppIcon size={16} />
              WhatsApp
            </a>
            <a
              href="mailto:oswaldoacf05@gmail.com"
              className="flex items-center gap-2 transition hover:text-white"
            >
              <Mail size={16} />
              Gmail
            </a>
            <a
              href="https://instagram.com/onperfumariaeimportados"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 transition hover:text-white"
            >
              <InstagramIcon size={16} />
              Instagram
            </a>
            <p>Fazemos atendimento local</p>
          </div>
        </div>
      </div>

      <div className="relative px-4 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {trustSeals.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d89a28]/15 text-[#e2b04f]">
                <Icon size={15} />
              </span>
              <span className="text-[11px] font-medium leading-4 text-[#e8d9ef]">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.2em] text-[#9b7fb0] sm:text-left">
          On Perfumaria e Importados — todos os direitos reservados
        </p>
      </div>
    </footer>
  )
}
