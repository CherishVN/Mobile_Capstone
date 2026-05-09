import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { userFacingGhnMessage } from '@/lib/ghn-user-message'
import { ghnService, isGhnTokenConfigured } from '@/services/ghn-service'
import type { Address } from '@/types/user'
import type { GHNService } from '@/types/ghn'

function pickPreferredGhnService(services: GHNService[]): GHNService | null {
  if (!services?.length) return null
  const byType = (t: number) => services.find((s) => s.service_type_id === t)
  return (
    byType(2) ?? byType(1) ?? byType(3) ?? services.find((s) => s.service_type_id > 0) ?? services[0] ?? null
  )
}

function orderGhnServicesToTry(list: GHNService[]): GHNService[] {
  if (!list.length) return []
  const preferred = pickPreferredGhnService(list)
  if (!preferred) return [...list]
  const rest = list.filter((s) => s.service_id !== preferred.service_id)
  return [preferred, ...rest]
}

function serviceTypeIdForGhnFeeBody(serviceTypeId: number): number | undefined {
  if (serviceTypeId >= 1 && serviceTypeId <= 3) {
    return serviceTypeId
  }
  return undefined
}

function logDevGhnError(userMessages: string[], rawTech: (string | undefined)[]) {
  if (!__DEV__) return
  if (rawTech.some(Boolean)) {
    // eslint-disable-next-line no-console
    console.warn('[GHN shipping]', rawTech.filter(Boolean))
  }
  if (userMessages.length) {
    // eslint-disable-next-line no-console
    console.warn('[GHN shipping] UI:', userMessages.join(' | '))
  }
}

function formatToastFromAddress(technical: string): string {
  if (technical.startsWith('Không tìm thấy')) {
    return technical
  }
  return userFacingGhnMessage(technical)
}

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
}

function fuzzyMatch(candidate: string, query: string): boolean {
  const c = normalize(candidate)
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return words.every((w) => c.includes(w))
}

export interface ShopShippingFee {
  fee: number | undefined
  leadTime?: number
  ghnServiceId?: string
  loading: boolean
  error: string | null
}

export interface UseGHNShippingFeeResult {
  shopFees: Map<string, ShopShippingFee>
  totalShippingFee: number
  isCalculating: boolean
  hasBlockingError: boolean
}

export interface ShopInput {
  key: string
  totalWeightGrams: number
  totalValue: number
  ghnShopId?: number | null
  fromDistrictId?: number | null
  fromWardCode?: string | null
}

const DEFAULT_WEIGHT = 1000

function buildAddressError(what: string, value: string) {
  return `Không tìm thấy "${value}" trên GHN (${what}). Sửa tỉnh / quận / xã trùng cách gọi mà GHN dùng.`
}

function stableGhnShopsKey(shops: ShopInput[]): string {
  if (shops.length === 0) return ''
  return JSON.stringify(
    [...shops]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((s) => ({
        key: s.key,
        totalWeightGrams: s.totalWeightGrams,
        totalValue: s.totalValue,
        ghnShopId: s.ghnShopId,
        fromDistrictId: s.fromDistrictId,
        fromWardCode: s.fromWardCode,
      })),
  )
}

function stableGhnAddressKey(address: Address | undefined): string {
  if (!address) return ''
  return [address.id, address.province, address.city, address.district, address.ward, address.addressLine1]
    .map((x) => (x == null ? '' : String(x)))
    .join('\x1e')
}

export function useGHNShippingFee(shops: ShopInput[], address: Address | undefined): UseGHNShippingFeeResult {
  const [shopFees, setShopFees] = useState<Map<string, ShopShippingFee>>(new Map())
  const abortRef = useRef<AbortController | null>(null)
  const addressRef = useRef(address)
  const shopsRef = useRef(shops)
  addressRef.current = address
  shopsRef.current = shops

  const ghnInputKey = useMemo(() => {
    if (!address) return ''
    if (shops.length === 0) return ''
    return `${stableGhnAddressKey(address)}\x1f${stableGhnShopsKey(shops)}`
  }, [
    address?.id,
    address?.province,
    address?.city,
    address?.district,
    address?.ward,
    address?.addressLine1,
    JSON.stringify(
      shops
        .map((s) => [s.key, s.totalWeightGrams, s.totalValue, s.ghnShopId ?? 0, s.fromDistrictId ?? 0, s.fromWardCode ?? ''].join(':'))
        .sort((a, b) => a.localeCompare(b)),
    ),
  ])

  const calculate = useCallback(async () => {
    const currentAddress = addressRef.current
    const currentShops = shopsRef.current

    if (!currentAddress || currentShops.length === 0) {
      setShopFees(new Map())
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setShopFees(
      new Map(
        currentShops.map((s) => [
          s.key,
          { fee: undefined, leadTime: undefined, ghnServiceId: undefined, loading: true, error: null },
        ]),
      ),
    )

    const applyAddressFailure = (errorMsg: string) => {
      const display = formatToastFromAddress(errorMsg)
      logDevGhnError([display], [errorMsg])
      setShopFees(
        new Map(currentShops.map((s) => [s.key, { fee: undefined, loading: false, error: display }])),
      )
    }

    if (!isGhnTokenConfigured()) {
      applyAddressFailure(
        'Thiếu EXPO_PUBLIC_GHN_TOKEN. Thêm token GHN (cùng giá trị với bản web NEXT_PUBLIC_GHN_TOKEN) vào .env rồi build lại ứng dụng.',
      )
      return
    }

    try {
      const provinces = await ghnService.getProvinces()
      if (controller.signal.aborted) return

      const provinceQuery = currentAddress.province || currentAddress.city
      const matchedProvince = provinces.find(
        (p) =>
          fuzzyMatch(p.ProvinceName, provinceQuery) ||
          (p.NameExtension ?? []).some((ext) => fuzzyMatch(ext, provinceQuery)),
      )

      if (!matchedProvince) {
        const msg = buildAddressError('tỉnh/thành', provinceQuery || '')
        applyAddressFailure(msg)
        return
      }

      const districts = await ghnService.getDistricts(matchedProvince.ProvinceID)
      if (controller.signal.aborted) return

      const districtQuery = currentAddress.district || ''
      const matchedDistrict = districts.find(
        (d) =>
          fuzzyMatch(d.DistrictName, districtQuery) || (d.NameExtension ?? []).some((ext) => fuzzyMatch(ext, districtQuery)),
      )

      if (!matchedDistrict) {
        const msg = buildAddressError('quận/huyện', districtQuery || '—')
        applyAddressFailure(msg)
        return
      }

      const wards = await ghnService.getWards(matchedDistrict.DistrictID)
      if (controller.signal.aborted) return

      const wardQuery = currentAddress.ward || ''
      const matchedWard = wards.find(
        (w) => fuzzyMatch(w.WardName, wardQuery) || (w.NameExtension ?? []).some((ext) => fuzzyMatch(ext, wardQuery)),
      )

      if (!matchedWard) {
        const msg = buildAddressError('phường/xã', wardQuery || '—')
        applyAddressFailure(msg)
        return
      }

      const results = await Promise.allSettled(
        currentShops.map(async (shop) => {
          const fallbackShopId = process.env.EXPO_PUBLIC_GHN_SHOP_ID ? Number(process.env.EXPO_PUBLIC_GHN_SHOP_ID) : undefined
          const ghnShopId = fallbackShopId || shop.ghnShopId
          let list: GHNService[] = []
          if (ghnShopId == null || shop.fromDistrictId == null) {
            throw new Error(
              'Shop chưa cấu hình đủ GHN (mã cửa hàng GHN và quận/huyện kho lấy hàng). Seller cần cập nhật trong cài đặt shop.',
            )
          }

          try {
            const raw = await ghnService.getAvailableServices(
              {
                shop_id: ghnShopId,
                from_district: shop.fromDistrictId,
                to_district: matchedDistrict.DistrictID,
              },
              ghnShopId,
            )
            list = raw
          } catch (e) {
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.warn('[GHN getAvailableServices]', e)
            }
            throw e instanceof Error ? e : new Error(String(e))
          }

          if (list.length === 0) {
            throw new Error(
              'GHN không có dịch vụ nào cho tuyến từ kho shop tới địa chỉ nhận này. Kiểm tra phường/xã — quận/huyện khớp dữ liệu GHN, hoặc đổi địa chỉ giao.',
            )
          }

          const candidates = orderGhnServicesToTry(list)
          const weightGrams = Math.max(shop.totalWeightGrams || 0, DEFAULT_WEIGHT)

          let feeData: { total: number } | null = null
          let usedServiceId: number | null = null
          let lastFeeError: unknown = null

          for (const svc of candidates) {
            const feeTypeForBody = serviceTypeIdForGhnFeeBody(svc.service_type_id)
            try {
              feeData = await ghnService.calculateFee(
                {
                  service_id: svc.service_id,
                  from_district_id: shop.fromDistrictId ?? undefined,
                  from_ward_code: shop.fromWardCode ?? undefined,
                  to_district_id: matchedDistrict.DistrictID,
                  to_ward_code: matchedWard.WardCode,
                  weight: weightGrams,
                  insurance_value: Math.min(shop.totalValue, 5_000_000),
                  ...(feeTypeForBody != null ? { service_type_id: feeTypeForBody } : {}),
                },
                ghnShopId,
              )
              usedServiceId = svc.service_id
              break
            } catch (e) {
              lastFeeError = e
              if (__DEV__) {
                // eslint-disable-next-line no-console
                console.warn('[GHN calculateFee] thử service_id', svc.service_id, e)
              }
            }
          }

          if (feeData == null || usedServiceId == null) {
            const msg =
              lastFeeError instanceof Error
                ? lastFeeError.message
                : 'GHN không tính được phí với mọi dịch vụ trên tuyến này.'
            throw new Error(msg)
          }

          let leadTime: number | undefined
          try {
            const leadTimeData = await ghnService.calculateLeadTime(
              {
                from_district_id: shop.fromDistrictId ?? undefined,
                from_ward_code: shop.fromWardCode ?? undefined,
                to_district_id: matchedDistrict.DistrictID,
                to_ward_code: matchedWard.WardCode,
                service_id: usedServiceId,
              },
              ghnShopId,
            )
            leadTime = leadTimeData.leadtime
          } catch (e) {
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.warn('Could not get lead time', e)
            }
          }

          return {
            key: shop.key,
            total: feeData.total,
            leadTime,
            ghnServiceId: String(usedServiceId),
          }
        }),
      )

      if (controller.signal.aborted) return

      const updatedMap = new Map<string, ShopShippingFee>()
      const errMsgs: string[] = []
      const rawForDev: string[] = []

      results.forEach((result, idx) => {
        const key = currentShops[idx].key
        if (result.status === 'fulfilled') {
          const v = result.value
          updatedMap.set(key, {
            fee: v.total,
            leadTime: v.leadTime,
            ghnServiceId: v.ghnServiceId,
            loading: false,
            error: null,
          })
        } else {
          const raw =
            result.reason instanceof Error
              ? result.reason.message
              : 'GHN không tính được phí (kiểm tra cấu hình kho, địa chỉ gửi, hoặc tuyến giao hàng).'
          const friendly = userFacingGhnMessage(raw)
          errMsgs.push(friendly)
          rawForDev.push(raw)
          updatedMap.set(key, { fee: undefined, loading: false, error: friendly })
        }
      })

      setShopFees(updatedMap)
      if (errMsgs.length > 0) {
        logDevGhnError(errMsgs, rawForDev)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const errMsg = err instanceof Error ? err.message : 'Lỗi kết nối GHN'
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[GHN shipping fee]', errMsg)
      }
      const friendly = userFacingGhnMessage(errMsg)
      setShopFees(new Map(currentShops.map((s) => [s.key, { fee: undefined, loading: false, error: friendly }])))
      logDevGhnError([friendly], [errMsg])
    }
  }, [ghnInputKey])

  useEffect(() => {
    void calculate()
    return () => {
      abortRef.current?.abort()
    }
  }, [calculate])

  const values = Array.from(shopFees.values())
  const totalShippingFee = values.reduce((sum, s) => {
    if (s.loading || s.fee == null || s.error) return sum
    return sum + s.fee
  }, 0)
  const isCalculating = values.some((s) => s.loading)
  const hasBlockingError = values.some((s) => !s.loading && s.error != null)

  return {
    shopFees,
    totalShippingFee,
    isCalculating,
    hasBlockingError,
  }
}
