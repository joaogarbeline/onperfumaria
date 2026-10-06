import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { itemCardToProduct } from '../../utils/productModel'
import { itemIcons } from './icons'

export type ItemCardContent = {
  id: string
  name: string
  description?: string
  imageUrl?: string
  price?: number
  tagLabel?: string
  createdAt?: string
  sku?: string
}

export function ItemCard({ className = '', item }: { className?: string; item: ItemCardContent }) {
  const { addItem } = useCart()
  const [favorited, setFavorited] = useState(false)
  const productName = item.name
  const productPrice = item.price || 0
  const displayPrice = productPrice
    ? productPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Preço não informado'
  const installmentPrice = productPrice / 12

  return (
    <Link
      to={`/produto/${item.id}`}
      className={`block overflow-hidden rounded-[24px] border border-[#e3cfee] bg-white ${className}`}
    >
      <div className="relative flex aspect-[3/4] items-center justify-center bg-[#eadcf0] text-[#d89a28]">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={productName} className="h-full w-full object-cover" />
        ) : (
          <img src={itemIcons.frascoGold} alt="Frasco de perfume" className="h-10 w-10 object-contain" />
        )}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setFavorited((value) => !value)
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={favorited ? 'Remover dos favoritos' : 'Favoritar'}
          aria-pressed={favorited}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center"
        >
          <img
            src={favorited ? itemIcons.coracaoPreenchido : itemIcons.coracaoContornado}
            alt=""
            className="h-6 w-6 object-contain"
          />
        </button>
      </div>
      <div className="space-y-2 p-4">
        {item.tagLabel ? (
          <span className="inline-block rounded-[14px] bg-[#fff1d6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b77717]">
            {item.tagLabel}
          </span>
        ) : null}
        <p className="text-sm font-semibold text-[#2a0f3d]">{productName}</p>
        {item.description ? (
          <p className="line-clamp-2 text-xs leading-5 text-[#6b665f]">{item.description}</p>
        ) : null}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2a0f3d]">{displayPrice}</p>
            {productPrice > 0 ? (
              <p className="mt-1 text-xs text-[#6b665f]">
                ou 12x de{' '}
                {installmentPrice.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            ) : null}
          </div>
          <div className="group relative">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                addItem(itemCardToProduct(item))
              }}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label="Colocar na sacola"
              className="flex h-9 w-9 items-center justify-center"
            >
              <img src={itemIcons.compra} alt="" className="h-7 w-7 object-contain" />
            </button>
            <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-[8px] bg-[#2a0f3d] px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              Colocar na sacola
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
