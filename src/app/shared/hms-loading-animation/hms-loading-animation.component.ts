import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';

@Component({
  selector: 'app-hms-loading-animation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hms-loading-animation.component.html',
  styleUrl: './hms-loading-animation.component.css'
})
export class HmsLoadingAnimationComponent implements OnInit, OnDestroy {
  @Input() logoUrl: string = '';
  @Input() loadingText: string = 'Loading HMS...';
  @Input() hotelName: string = 'HMS Cloud';
  @Input() isVisible: boolean = true;

  @ViewChild('particleCanvas', { static: false }) particleCanvas!: ElementRef<HTMLCanvasElement>;

  // Cycling dynamic status messages
  statusMessages: string[] = [
    'Initializing HMS Cloud...',
    'Loading hotel configuration...',
    'Verifying master data & room status...',
    'Preparing front office dashboard...',
    'Almost ready...'
  ];

  currentStatusIndex = signal(0);
  currentStatusText = signal(this.statusMessages[0]);

  private messageIntervalTimer: any;
  private animationFrameId: number | null = null;
  private particles: Array<{ x: number; y: number; radius: number; angle: number; speed: number; orbitRadius: number; opacity: number }> = [];

  ngOnInit(): void {
    this.startStatusMessageCycle();
  }

  ngAfterViewInit(): void {
    this.initCanvasParticles();
  }

  ngOnDestroy(): void {
    if (this.messageIntervalTimer) {
      clearInterval(this.messageIntervalTimer);
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private startStatusMessageCycle(): void {
    let index = 0;
    this.messageIntervalTimer = setInterval(() => {
      index = (index + 1) % this.statusMessages.length;
      this.currentStatusIndex.set(index);
      this.currentStatusText.set(this.statusMessages[index]);
    }, 1200);
  }

  private initCanvasParticles(): void {
    if (!this.particleCanvas) return;
    const canvas = this.particleCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = 300);
    const height = (canvas.height = 300);
    const centerX = width / 2;
    const centerY = height / 2;

    // Create lightweight orbital particles
    this.particles = [];
    const particleCount = 24;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        radius: Math.random() * 1.8 + 0.8,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1),
        orbitRadius: Math.random() * 45 + 75,
        opacity: Math.random() * 0.7 + 0.3
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      this.particles.forEach(p => {
        p.angle += p.speed;
        p.x = centerX + Math.cos(p.angle) * p.orbitRadius;
        p.y = centerY + Math.sin(p.angle) * (p.orbitRadius * 0.45); // Elliptical perspective orbit

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${p.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#10B981';
        ctx.fill();
      });

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }
}
