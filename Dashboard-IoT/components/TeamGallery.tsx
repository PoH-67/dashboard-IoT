"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import type { AutoplayOptions } from "swiper/types";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import FadeIn from "./FadeIn";

type ColumnType = "tall" | "medium" | "short";
type Member = { name: string; role: string; src: string };
type TeamColumn = { type: ColumnType; className: string; images: Member[] };

const IMAGE_HEIGHTS: Record<ColumnType, number> = {
  tall: 280,
  medium: 240,
  short: 180,
};

const SIZE_CLASSES: Record<ColumnType, string> = {
  tall: "w-full h-[280px]",
  medium: "w-full h-[240px]",
  short: "w-full h-[180px]",
};

const IMAGE_SIZES = "(min-width: 1024px) 16vw, (min-width: 768px) 33vw, 50vw";
const IMAGE_QUALITY = 70;

const SLIDE_BASE_STYLE: React.CSSProperties = {
  pointerEvents: "none",
  transition: "opacity 0.6s ease, transform 0.6s ease",
};

const SWIPER_BREAKPOINTS = {
  430: { slidesPerView: 2 },
  768: { slidesPerView: 3 },
  1024: { slidesPerView: 5 },
  1280: { slidesPerView: 6 },
};

const AUTOPLAY_CONFIG: AutoplayOptions = {
  delay: 3000,
  disableOnInteraction: false,
  waitForTransition: true,
  reverseDirection: false,
};

/**
 * 15 members → 7 columns, no column with a single photo.
 * Symmetric layout: tall · medium · tall · short · tall · medium · tall
 * (tall/medium hold 2 photos, short holds 3 so every column ends at a similar height).
 */
const TEAM_COLUMNS: TeamColumn[] = [
  {
    type: "tall",
    className: "",
    images: [
      { name: "Khalil Farel Fauzan",      role: "Head of Software Division",  src: "/team/Software_Ketua.webp" },
      { name: "Ramadhani Putra Yuditama", role: "Staff of Software Division", src: "/team/Software_Staff_1.webp" },
    ],
  },
  {
    type: "medium",
    className: "pt-10",
    images: [
      { name: "Abdurrahman Al Ghilari", role: "Staff of Software Division", src: "/team/Software_Staff_2.webp" },
      { name: "Fahri Pratama",          role: "Staff of Software Division", src: "/team/Software_Staff_3.webp" },
    ],
  },
  {
    type: "tall",
    className: "",
    images: [
      { name: "Kaka Ramadhan",                role: "Staff of Software Division", src: "/team/Software_Staff_4.webp" },
      { name: "Maleakhi Adriel Anindya D.S.", role: "Head of UI/UX Division",     src: "/team/UiUx_Ketua.webp" },
    ],
  },
  {
    type: "short",
    className: "",
    images: [
      { name: "Sion Lukas Elkana Panjaitan", role: "Staff of UI/UX Division",  src: "/team/UiUx_Staff_1.webp" },
      { name: "Nasya Kalia Shalemina",       role: "Staff of UI/UX Division",  src: "/team/UiUx_Staff_2.webp" },
      { name: "Daniel Hendriko Sirait",      role: "Head of Network Division", src: "/team/Network_Ketua.webp" },
    ],
  },
  {
    type: "tall",
    className: "",
    images: [
      { name: "Aura Adillah",       role: "Staff of Network Division", src: "/team/Network_Staff_1.webp" },
      { name: "Agrieva Hindaru R.", role: "Staff of Network Division", src: "/team/Network_Staff_2.webp" },
    ],
  },
  {
    type: "medium",
    className: "pt-10",
    images: [
      { name: "Ilham Surya Rizqullah", role: "Head of Firmware Division",  src: "/team/Firmware_Ketua.webp" },
      { name: "Muhammad Fajar Sodik",  role: "Staff of Firmware Division", src: "/team/Firmware_Staff_1.webp" },
    ],
  },
  {
    type: "tall",
    className: "",
    images: [
      { name: "Daffa Muhammad Rizki",     role: "Staff of Firmware Division", src: "/team/Firmware_Staff_2.webp" },
      { name: "Raden Dimas Sayyidina A.", role: "Staff of Firmware Division", src: "/team/Firmware_Staff_3.webp" },
    ],
  },
];

/**
 * Only flip autoplay direction AFTER the slide transition has completely finished
 * arriving at the first or last slide, so edge columns are always shown in full.
 */
function handleTransitionEnd(swiper: SwiperInstance) {
  const autoplay = swiper.params.autoplay;
  if (!autoplay || typeof autoplay !== "object") return;

  if (swiper.isEnd && !autoplay.reverseDirection) {
    autoplay.reverseDirection = true;
    swiper.autoplay.start();
  } else if (swiper.isBeginning && autoplay.reverseDirection) {
    autoplay.reverseDirection = false;
    swiper.autoplay.start();
  }
}

export default function TeamGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleSlides, setVisibleSlides] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const slides = container.querySelectorAll(".swiper-slide");
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSlides((prev) => {
          let shouldUpdate = false;
          const next = new Set(prev);

          entries.forEach((entry) => {
            const slideIndex = Number(entry.target.getAttribute("data-slide-index"));
            if (Number.isNaN(slideIndex)) return;

            if (entry.isIntersecting) {
              if (!next.has(slideIndex)) {
                next.add(slideIndex);
                shouldUpdate = true;
              }
            } else if (next.has(slideIndex)) {
              next.delete(slideIndex);
              shouldUpdate = true;
            }
          });

          return shouldUpdate ? next : prev;
        });
      },
      { root: container, rootMargin: "250px", threshold: 0 }
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="lp-team">
      <FadeIn direction="down" delay={0.8}>
        <div className="w-full flex flex-col items-center justify-center px-3 py-3">
          <h2 className="text-4xl md:text-5xl font-semibold text-[#2C3E50] mb-10 text-center select-none">
            Our Team
          </h2>
        </div>
      </FadeIn>

      <FadeIn direction="up" delay={0.4}>
        <div className="swiper-container-wrap overflow-hidden" ref={containerRef}>
          <Swiper
            modules={[Autoplay]}
            spaceBetween={22}
            slidesPerView={2}
            loop={false}
            autoplay={AUTOPLAY_CONFIG}
            speed={12000}
            allowTouchMove={false}
            noSwiping={true}
            noSwipingClass="swiper-slide"
            breakpoints={SWIPER_BREAKPOINTS}
            onTransitionEnd={handleTransitionEnd}
            className="pp-tm-wrapper pp-tm-carousel"
          >
            {TEAM_COLUMNS.map((column, index) => {
              const isVisible = visibleSlides.has(index);
              const isInitial = visibleSlides.size === 0;
              const sizeClass = SIZE_CLASSES[column.type];
              const imageHeight = IMAGE_HEIGHTS[column.type];

              return (
                <SwiperSlide
                  key={index}
                  className="swiper-slide"
                  data-slide-index={index}
                  style={{
                    ...SLIDE_BASE_STYLE,
                    opacity: isInitial || isVisible ? 1 : 0,
                    transform: isInitial || isVisible ? "scale(1)" : "scale(0.92)",
                  }}
                >
                  <div className={`flex flex-col gap-5 select-none ${column.className}`}>
                    {column.images.map((member, imgIndex) => (
                      <FadeIn key={member.src} direction="up" delay={imgIndex * 0.1}>
                        <div className="relative overflow-hidden rounded-lg shadow-md">
                          <Image
                            src={member.src}
                            alt={member.name}
                            width={240}
                            height={imageHeight}
                            sizes={IMAGE_SIZES}
                            quality={IMAGE_QUALITY}
                            className={`rounded-lg object-cover ${sizeClass}`}
                          />
                          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-[rgba(10,28,52,0.88)] to-transparent px-2.5 pt-7 pb-2.5">
                            <span className="text-[11px] font-bold leading-tight text-white">
                              {member.name}
                            </span>
                            <span className="text-[9px] leading-tight text-[#8ec4e8]">
                              {member.role}
                            </span>
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </FadeIn>
    </section>
  );
}
